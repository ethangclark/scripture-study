# Content pass: graphic detail

The abridged Old Testament keeps half its verses. Its reader found that the
Book of Mormon abridgement showed good taste by omitting graphic passages that
detracted from reading (for example Moroni 9:7-10: prisoners fed the flesh of
their husbands, women raped, tortured and eaten). The first Old Testament pass
was wrongly told NOT to omit such material. Your job is to fix that for one
part of the Old Testament.

The input shows every verse with its current state: `[K]` kept, `[-]` cut,
and `>> bridge` notes (shown before the kept verse they sit on).

## Drop (from kept verses)

Kept verses whose graphic detail detracts from a reader's experience:
sexual violence and its aftermath described in detail, torture and
mutilation, cannibalism, gore and bodily horror, cruelty to children and
infants (e.g. Psalm 137:9), lingering descriptions of atrocity or corpses,
lurid sexual detail. Use judgement: a battle, a death, a judgment, or an
execution stated plainly is fine and often essential. Drop the detail, not
the story. Violence that is the point of a well-known, meaningful story told
without lingering (Cain and Abel, David and Goliath, Samson's death) stays.

## Keep the story readable

If dropping verses leaves a gap a reader would stumble over, add or rewrite
a bridge on the next kept verse: one or two plain sentences under ~40 words
that say what happened without graphic detail ("A mob in Gibeah abuses the
Levite's concubine through the night, and she dies." not the details).
Bridges may only sit on a kept verse whose immediately preceding verse (in
canonical order, across chapters) is cut. If a verse you drop carries a
bridge, move or rewrite that bridge onto the next kept verse.

## Keep the count

For every verse you drop, restore one currently cut verse: the strongest
cut verse you can find, preferably in the same chapter or book, that reads
cleanly where it lands and does not itself create a stumble or add graphic
content. `len(keep) == len(drop)` in every fix.

## Output

Write a JSON array to the path you are given, one entry per fix, references
in full "Book Chapter:Verse" form:

```json
{"why": "Judges 19:25-28 describes the concubine's abuse and death in detail",
 "drop": ["Judges 19:25", "Judges 19:26"], "keep": ["Judges 20:12", "Judges 20:13"],
 "bridges": {"Judges 19:27": "..."}}
```

Validate with python: every reference exists in the input, each `drop` is
currently `[K]`, each `keep` is currently `[-]`, lengths match, JSON parses,
and each bridge will sit on a kept verse preceded by a cut verse after your
changes. Set a bridge to "" to remove one.

If your part has nothing that warrants a change, write `[]`.

Reply with a short report listing each passage you changed and why, and any
borderline passages you deliberately left.
