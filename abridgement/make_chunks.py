"""Split a volume into chapter-aligned chunks for selection agents.

Run from the volume's working directory; ABR_SRC and ABR_CHUNKS override the
source JSON and the number of chunks.
"""
import json
import os

d = json.load(open(os.environ.get("ABR_SRC", "../scriptures-json/book-of-mormon.json")))
budgets = json.load(open("budgets.json"))
chaps = [c for b in d["books"] for c in b["chapters"]]
total = sum(len(v["text"]) for c in chaps for v in c["verses"])
N = int(os.environ.get("ABR_CHUNKS", 9))
os.makedirs("chunks", exist_ok=True)
chunk, size, idx = [], 0, 1

def flush():
    global chunk, size, idx
    lines = []
    for c in chunk:
        lines.append(f"\n## {c['reference']}  [{len(c['verses'])} verses, keep {budgets[c['reference']]}]")
        lines += [f"{v['reference']} | {v['text']}" for v in c["verses"]]
    open(f"chunks/chunk{idx}.txt", "w").write("\n".join(lines).lstrip() + "\n")
    print(idx, chunk[0]["reference"], "->", chunk[-1]["reference"], size)
    chunk, size, idx = [], 0, idx + 1

for c in chaps:
    chunk.append(c)
    size += sum(len(v["text"]) for v in c["verses"])
    if size >= total / N and idx < N:
        flush()
flush()
