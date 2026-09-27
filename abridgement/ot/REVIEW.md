# Cold-read review of the abridged Old Testament

An abridgement keeping half the verses has been drafted, aiming to be
more engrossing, narratively and doctrinally, than the full text. Italic block
quotes (`> *...*`) are "bridges": short summaries shown at a gap where the
skipped verses would otherwise leave a reader confused.

You are given one part of the abridged text. **Read it first, cold, start to
finish, as a newcomer would, before looking at the full text.** Note every
place where you stumble:

- a character, place, or group appears without introduction
- a pronoun or "this/these things/again/the third time" points at nothing
- the speaker, audience, setting, or time jumps without signal
- an event is referred to that the reader never saw
- a verse begins mid-sentence ("saying:" with nothing after, "Wherefore..."
  following something it does not follow from)
- a bridge that is wrong, misleading, redundant, or wordy (over ~40 words)
- a run of lone single verses that reads like a highlight reel rather than
  prose

Only then open the full text (`../../scriptures-json/old-testament.json`, or
grep it) to diagnose each stumble and pick the lightest fix:

1. **Swap**: keep one or more dropped verses and drop the same number of kept
   verses, ideally in the same chapter, choosing kept verses whose loss does
   not create a new stumble. The number of verses kept must stay the same:
   `len(keep) == len(drop)` for every fix.
2. **Bridge**: add or rewrite a bridge (one or two plain present-day English
   sentences, under ~40 words) on the first kept verse after a gap, or remove
   a bad one by setting it to "". A bridge may only sit on a kept verse whose
   immediately preceding verse (in canonical order, across chapter
   boundaries) is dropped.

Prefer swaps when the missing verse is itself strong; prefer bridges when the
missing material is long or dull. Do not fix what is not broken, and do not
re-litigate the abridgement's taste; fix confusion and bad flow. Big famous
verses that were dropped by mistake may be restored via a swap.

## Output

Write a JSON array to the path you are given. References use the full form
"Book Chapter:Verse" (e.g. "1 Samuel 17:45"). Each fix:

```json
{"why": "Abner appears at 17:55 but was never introduced",
 "keep": ["1 Samuel 14:50"], "drop": ["1 Samuel 17:25"],
 "bridges": {"1 Samuel 17:4": "rewritten bridge text"}}
```

`keep`, `drop` and `bridges` are each optional, but keep/drop must be equal in
length. Validate with python that every referenced verse exists, that each
`keep` verse is currently dropped and each `drop` verse is currently kept (the
current state is what appears in your part: a verse is kept iff its number is
shown in bold under its chapter heading), and that the JSON parses.

Reply with a short report: how many stumbles, how you fixed them, and the
worst remaining weaknesses you chose not to fix.
