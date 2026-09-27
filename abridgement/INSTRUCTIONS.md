# Book of Mormon abridgement: verse selection instructions

We are making an abridged Book of Mormon that keeps exactly half of its 6,604
verses. The goal is a text that is **more engrossing, both narratively and
doctrinally**, than the full book: a reader should be pulled along by the story
and moved by the teaching, without wading through repetition.

You are given a chunk of consecutive chapters. Each chapter header shows its
verse count and a **keep budget** (how many verses to keep). Budgets were set
book-wide; hit each chapter's budget exactly unless readability forces a
difference of 1–2 verses (the final script rebalances using your scores).

## What to keep (score high)

- Core doctrine told memorably: Christ, the Atonement, faith, repentance,
  covenants, grace, the plan of salvation. Famous and much-quoted verses
  (e.g. 1 Ne 3:7, 2 Ne 2:25, Mosiah 2:17, Alma 32:21, Ether 12:27, Moroni 10:4–5)
  should essentially always survive.
- Plot the rest of the book depends on: departures, conversions, battles that
  change things, deaths, covenants, the introduction of every character who
  matters later.
- Scene-setting a reader needs: who is speaking, to whom, where, and why.
- Emotional and literary peaks: Nephi's psalm, Alma's conversion, the stripling
  warriors, Christ blessing the children, Moroni's final words.
- Vivid concrete detail that makes a scene live, over abstract restatement.

## What to drop (score low)

- Restatement: the second and third way of saying the same thing.
- Genealogy, regnal lists, dates, and "and thus ended the Nth year" formulas
  (unless a transition is actually needed).
- Military logistics: troop movements, city lists, fortification detail,
  repeated letters, once the shape of a campaign is clear.
- Long Isaiah quotations. Editorial call: drop nearly all of 1 Ne 20–21,
  2 Ne 7–8 and 2 Ne 12–24; keep only a few famous, self-contained verses
  (e.g. the mountain of the Lord's house, "unto us a child is born", the stem
  of Jesse / ensign to the nations). Nephi's own commentary on Isaiah (2 Ne 25–
  33) and Abinadi's use of Isaiah 53 (Mosiah 14) are kept on their merits.
- Pure connective filler ("And it came to pass that...") whose content the
  surrounding kept verses already convey.

## Readability rules (these matter as much as importance)

- Read the kept verses in order in your head: they must flow as prose.
- Do not keep a verse that begins mid-thought ("Wherefore...", "And they
  said...", "Yea, and...") without keeping what it depends on, unless it
  still reads cleanly after the previous kept verse.
- Prefer keeping and dropping in runs rather than alternating single verses;
  a choppy alternating pattern is worse than dropping a slightly better verse.
- Watch for back-references that a cut would orphan: "again", "the third
  time", "these things", "the aforesaid", a pronoun whose antecedent was cut.
  Keep the referent, drop the referring verse, or (if neither works) bridge.
- A sermon's opening that identifies the speaker, and its climax, beat its
  middle.
- Whole chapters with a budget of 0 are fine; cover them with a bridge.

## Bridges (`bridge`)

After choosing, read ONLY your kept verses in order, as a newcomer would. At
each gap (one or more dropped verses, including whole dropped chapters), ask:
would a reader be confused here? E.g. a character appears unintroduced, the
setting jumps, a pronoun has no referent, the speaker changes, an event is
referred to that was cut, or time passes unexplained.

If yes, write a `bridge` on the **first kept verse after the gap**: one or two
plain sentences (under ~40 words) summarising what was skipped, in neutral
present-day English (not scriptural pastiche). If no confusion arises, write no
bridge. Most gaps should NOT need one; do not summarise for completeness' sake.

If your chunk ENDS with dropped verses that a reader would need summarised,
put that bridge under the key `"__tail__"`; it will be attached to the next
kept verse in the following chunk.

## Output

Write a JSON file at the path you are given, with one entry per verse in your
chunk, keyed by reference, in order:

```json
{
  "1 Nephi 1:1": {"keep": true, "score": 95},
  "1 Nephi 1:2": {"keep": false, "score": 30},
  "1 Nephi 1:5": {"keep": true, "score": 70, "bridge": "Lehi, praying for his people, sees a pillar of fire and is overcome."},
  "__tail__": {"bridge": "..."}
}
```

- `score`: 0–100, your judgement of how much the verse earns its place
  (importance + readability). Use the whole range; kept verses should outscore
  dropped verses in the same chapter. The score is used to add or remove a
  handful of verses book-wide to hit exactly 50%.
- Every verse in the chunk must appear exactly once. Validate the file
  with python (json parses, entry count matches, per-chapter kept counts vs
  budgets) before finishing.

Finally, reply with a short report: per-chapter kept vs budget where they
differ, number of bridges, and any judgement calls worth a human's attention.
