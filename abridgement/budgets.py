"""Chapter retention budgets for the Book of Mormon abridgement.

Each value is the target fraction of a chapter's verses to keep. The weights
are rescaled by make_budgets() so the whole book keeps exactly half its verses.
Guiding aim: keep the book engrossing, narratively and doctrinally. Long
Isaiah quotations (outside Abinadi's use of Isaiah 53) are mostly dropped,
with a handful of famous verses surviving.
"""
import json
import math

W = {
 "1 Nephi": [.8,.7,.75,.7,.35,.3,.55,.85,.2,.5,.85,.55,.45,.4,.5,.7,.65,.7,.3,.12,.15,.3],
 "2 Nephi": [.55,.95,.35,.5,.65,.35,.12,.1,.8,.4,.3,.14,.05,.1,.05,.08,.1,.05,.12,.03,.25,.1,.03,.03,
             .6,.55,.45,.55,.55,.3,.95,.85,.75],
 "Jacob": [.5,.6,.45,.6,.45,.6,.9],
 "Enos": [.95], "Jarom": [.3], "Omni": [.45], "Words of Mormon": [.5],
 "Mosiah": [.45,.75,.85,.85,.9,.3,.55,.5,.4,.3,.55,.5,.55,.85,.75,.65,.8,.8,.5,.35,.4,.4,.45,.6,.3,.5,.85,.4,.3],
 "Alma": [.6,.3,.2,.35,.65,.2,.6,.65,.45,.45,.55,.5,.5,.7,.45,.3,.75,.85,.8,.55,.3,.75,.3,.65,.3,.55,.4,.2,.8,
          .65,.55,.9,.65,.75,.2,.95,.65,.7,.6,.55,.55,.75,.3,.45,.4,.6,.55,.5,.25,.3,.35,.25,.35,.4,.3,.5,.4,.3,.25,.35,.3,.25,.3],
 "Helaman": [.35,.35,.35,.35,.75,.3,.55,.5,.6,.65,.3,.55,.55,.7,.4,.5],
 "3 Nephi": [.75,.3,.4,.35,.35,.3,.3,.7,.6,.4,.95,.6,.55,.5,.45,.3,.95,.8,.7,.3,.25,.2,.4,.35,.35,.4,.7,.6,.3,.5],
 "4 Nephi": [.7],
 "Mormon": [.55,.5,.5,.3,.45,.8,.5,.65,.6],
 "Ether": [.3,.75,.9,.45,.3,.7,.3,.5,.35,.2,.2,.8,.45,.35,.7],
 "Moroni": [.5,.3,.2,.4,.2,.6,.9,.55,.45,.95],
}

def make_budgets(path="../scriptures-json/book-of-mormon.json", W=W):
    d = json.load(open(path))
    chaps = []
    for b in d["books"]:
        w = W[b["book"]]
        assert len(w) == len(b["chapters"]), b["book"]
        for c, f in zip(b["chapters"], w):
            chaps.append([c["reference"], len(c["verses"]), f])
    total = sum(n for _, n, _ in chaps)
    target = total // 2
    # Scale weights so the expected kept count equals the target, then round.
    lo, hi = 0.0, 5.0
    for _ in range(60):
        k = (lo + hi) / 2
        s = sum(min(1.0, f * k) * n for _, n, f in chaps)
        lo, hi = (k, hi) if s < target else (lo, k)
    out = {ref: round(min(1.0, f * k) * n) for ref, n, f in chaps}
    # Fix rounding drift on the chapters with the largest remainders.
    drift = target - sum(out.values())
    order = sorted(chaps, key=lambda c: -(min(1.0, c[2] * k) * c[1] % 1))
    i = 0
    while drift:
        ref, n, _ = order[i % len(order)]
        step = 1 if drift > 0 else -1
        if 0 <= out[ref] + step <= n:
            out[ref] += step
            drift -= step
        i += 1
    return out, total, target

if __name__ == "__main__":
    out, total, target = make_budgets()
    json.dump(out, open("budgets.json", "w"), indent=1)
    print(total, target, sum(out.values()))
