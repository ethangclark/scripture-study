# Old Testament abridgement: verse selection instructions

We are making an abridged Old Testament (KJV) that keeps half of its 23,145
verses. The goal is a text that is **more engrossing, both narratively and
doctrinally**, than the full book: a reader should be pulled along by the story
and moved by the teaching, without wading through repetition.

You are given a chunk of consecutive chapters. Each chapter header shows its
verse count and a **keep budget** (how many verses to keep). Budgets were set
book-wide; hit each chapter's budget exactly unless readability forces a
difference of 1–2 verses (the final script rebalances using your scores).

## What to keep (score high)

- Core teaching told memorably: God's nature and covenants, creation, the
  commandments, repentance and mercy, justice for the poor, messianic hope.
  Famous and much-quoted verses (e.g. Gen 1:1, 1:27, Ex 3:14, 20:3–17,
  Deut 6:4–5, Josh 24:15, Ruth 1:16, 1 Sam 16:7, Job 19:25, Ps 23, Prov 3:5–6,
  Eccl 3:1–8, Isa 1:18, 40:31, 53, Jer 1:5, Mic 6:8, Mal 3:10) should
  essentially always survive.
- Plot the rest of the volume depends on: covenants, births, exoduses,
  conquests, kings rising and falling, exile and return, and the introduction
  of every character who matters later.
- Scene-setting a reader needs: who is speaking, to whom, where, and why.
- Emotional and literary peaks: Abraham and Isaac, Joseph revealing himself,
  the Red Sea, David and Goliath, David and Bathsheba and Nathan, Elijah on
  Carmel and at Horeb, the whirlwind speeches in Job, Daniel's lions' den.
- Vivid concrete detail that makes a scene live, over abstract restatement.

## What to drop (score low)

- Restatement: the second and third way of saying the same thing.
- Genealogy, census totals, city and boundary lists, regnal formulas ("and
  the rest of the acts of ... are they not written ...", "he slept with his
  fathers") unless a transition is actually needed.
- Specifications: tabernacle and temple measurements and furnishings, priestly
  garments, sacrifice procedures, purity regulations. Keep a representative
  verse or two where they show what the ritual meant.
- Parallel passages: where the same material appears twice (Chronicles
  retelling Samuel–Kings, Isaiah 36–39 / 2 Kings 18–20, Psalm 18 / 2 Samuel
  22, Psalm 14 / 53, the Ten Commandments in Deut 5), the budgets already
  favour one copy; in the other keep only what is new.
- Hebrew poetry repeats each thought in parallel lines. Keep a poem's
  strongest, most self-contained verses in runs; do not keep every echo.
- Military detail, once the shape of a campaign is clear.
- Do not cut passages merely because they are violent or disturbing; judge
  them on the same importance and readability grounds as anything else.
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
- A sermon's or oracle's opening that identifies the speaker, and its climax,
  beat its middle. In Psalms, each psalm stands alone; a kept psalm should
  read as a coherent (if shortened) poem.
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
  "Genesis 11:1": {"keep": true, "score": 80},
  "Genesis 11:10": {"keep": false, "score": 5},
  "Genesis 11:27": {"keep": true, "score": 75, "bridge": "Ten generations pass from Noah's son Shem to Terah."},
  "__tail__": {"bridge": "..."}
}
```

- `score`: 0–100, your judgement of how much the verse earns its place
  (importance + readability). Use the whole range; kept verses should outscore
  dropped verses in the same chapter. The score is used to add or remove a
  handful of verses book-wide to hit the target of half.
- Every verse in the chunk must appear exactly once. Validate the file
  with python (json parses, entry count matches, per-chapter kept counts vs
  budgets) before finishing.

Finally, reply with a short report: per-chapter kept vs budget where they
differ, number of bridges, and any judgement calls worth a human's attention.
