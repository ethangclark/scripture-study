"""Merge chunk selections, rebalance to exactly 50%, and write the fields into
book-of-mormon.json with a minimal textual diff.

Usage: python3 merge.py [--write]
Run from a volume's working directory (this one for the Book of Mormon,
ot/ for the Old Testament); set ABR_SRC to the volume's JSON path.
Also writes abridged.md, a readable rendering of the abridged text.
"""
import glob
import json
import os
import re
import sys

SRC = os.environ.get("ABR_SRC", "../scriptures-json/book-of-mormon.json")
d = json.load(open(SRC, encoding="utf-8"))
verses = [v for b in d["books"] for c in b["chapters"] for v in c["verses"]]
refs = [v["reference"] for v in verses]
target = len(refs) // 2

sel, tails = {}, []
for path in sorted(glob.glob("out/chunk*.json"), key=lambda p: int(re.findall(r"\d+", p)[0])):
    o = json.load(open(path, encoding="utf-8"))
    tail = o.pop("__tail__", None)
    for r, e in o.items():
        assert r not in sel, f"duplicate {r}"
        sel[r] = e
    if tail and tail.get("bridge"):
        tails.append((list(o)[-1], tail["bridge"]))

missing = [r for r in refs if r not in sel]
extra = [r for r in sel if r not in set(refs)]
assert not missing and not extra, (missing[:5], extra[:5])
keep = {r: bool(sel[r]["keep"]) for r in refs}
score = {r: sel[r].get("score", 50) for r in refs}
bridge = {r: sel[r]["bridge"].strip() for r in refs if sel[r].get("bridge")}

# Apply cold-review fixes (review/*.json): swaps keep the count unchanged.
for path in sorted(glob.glob("review/*.json")):
    for f in json.load(open(path, encoding="utf-8")):
        for r in f.get("keep", []):
            keep[r] = True; score[r] = max(score[r], 90)
        for r in f.get("drop", []):
            keep[r] = False; score[r] = min(score[r], 10)
        for r, text in f.get("bridges", {}).items():
            if text: bridge[r] = text
            else: bridge.pop(r, None)

# Attach each chunk's tail bridge to the next kept verse.
for last, text in tails:
    i = refs.index(last) + 1
    while i < len(refs) and not keep[refs[i]]:
        i += 1
    if i < len(refs):
        r = refs[i]
        bridge[r] = f"{text} {bridge[r]}" if r in bridge else text

# Rebalance to exactly half. Prefer changes that do not create an isolated
# verse (a keep/drop that differs from both neighbours).
def isolation_penalty(i, new):
    nb = [keep[refs[j]] for j in (i - 1, i + 1) if 0 <= j < len(refs)]
    return 15 if nb and all(n != new for n in nb) else 0

changes = []
while sum(keep.values()) != target:
    adding = sum(keep.values()) < target
    cands = [i for i, r in enumerate(refs) if keep[r] != adding and not (adding is False and r in bridge)]
    key = (lambda i: -score[refs[i]] + isolation_penalty(i, True)) if adding \
        else (lambda i: score[refs[i]] + isolation_penalty(i, False))
    i = min(cands, key=key)
    keep[refs[i]] = adding
    changes.append(("+" if adding else "-") + refs[i])

# Bridges only make sense on kept verses that follow a gap.
for r in list(bridge):
    i = refs.index(r)
    if not keep[r]:
        j = i + 1
        while j < len(refs) and not keep[refs[j]]:
            j += 1
        text = bridge.pop(r)
        if j < len(refs):
            bridge[refs[j]] = f"{text} {bridge[refs[j]]}" if refs[j] in bridge else text
    elif i > 0 and keep[refs[i - 1]]:
        print("dropping bridge with no preceding gap:", r)
        bridge.pop(r)

print(f"kept {sum(keep.values())}/{len(refs)}; rebalanced {len(changes)}: {' '.join(changes)}")
print(f"bridges: {len(bridge)}")

# Per-book stats.
stats = []
for b in d["books"]:
    rs = [v["reference"] for c in b["chapters"] for v in c["verses"]]
    k = sum(keep[r] for r in rs)
    full_drop = [c["reference"] for c in b["chapters"] if not any(keep[v["reference"]] for v in c["verses"])]
    stats.append((b["book"], k, len(rs), full_drop))
    print(f"  {b['book']:<16} {k:>4}/{len(rs):<4} {100 * k / len(rs):5.1f}%  dropped chapters: {len(full_drop)}")
json.dump(stats, open("stats.json", "w"), indent=1)

# Readable rendering.
md = [f"# {d.get('title', 'The Book of Mormon')}, abridged", ""]
for b in d["books"]:
    md += [f"## {b['book']}", ""]
    for c in b["chapters"]:
        kept = [v for v in c["verses"] if keep[v["reference"]] or v["reference"] in bridge]
        if not kept:
            continue
        md += [f"### {c['reference']}", ""]
        for v in c["verses"]:
            r = v["reference"]
            if r in bridge:
                md += [f"> *{bridge[r]}*", ""]
            if keep[r]:
                md += [f"**{v['verse']}** {v['text']}", ""]
open("abridged.md", "w", encoding="utf-8").write("\n".join(md))

if "--write" in sys.argv:
    s = open(SRC, encoding="utf-8").read()
    out, pos, n = [], 0, 0
    pat = re.compile(r'"reference": "([^"]+)",\n[^\n]*"text": [^\n]*\n(\s*)"verse": (\d+)')
    for m in pat.finditer(s):
        r, indent = m.group(1), m.group(2)
        if r not in keep:
            continue
        add = f',\n{indent}"survivesAbridgement": {"true" if keep[r] else "false"}'
        if r in bridge:
            add += f',\n{indent}"abridgementBridge": {json.dumps(bridge[r], ensure_ascii=False)}'
        out += [s[pos:m.end()], add]
        pos = m.end()
        n += 1
    out.append(s[pos:])
    assert n == len(refs), n
    new = "".join(out)
    nd = json.loads(new)
    nv = [v for b in nd["books"] for c in b["chapters"] for v in c["verses"]]
    assert sum(v["survivesAbridgement"] for v in nv) == target
    assert all(a["text"] == b["text"] for a, b in zip(verses, nv))
    open(SRC, "w", encoding="utf-8").write(new)
    print("wrote", SRC)
