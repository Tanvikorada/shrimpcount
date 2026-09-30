# Hatchery field test: how to measure accuracy (about 2 weeks of normal work)

Goal: find out how close the automatic count is to a careful hand count, on many different trays, with nothing extra to
learn. The app already has the two boxes you need.

## What the hatchery does, for each tray they would normally count

1. Take the photo in the app as usual (same box, same height, same light).
2. **Before looking at the app's number**, two people count the same tray by hand. Write down both, then work out the average.
3. In the app, open **Details** and type the average in **"Your hand count"**. If you also have another app's number for that
   same tray, type it in **"Other app's count"**. Then Save.
4. Do not tap marks just to make the number match. Fix a mark only when it is clearly wrong; the app records how many marks were
   added or removed by hand.

## What is needed for the numbers to mean something

- **At least 15 different trays, 30 is better.** Repeat photos of one tray do not count as separate trays.
- A spread of trays: sparse and crowded, different tanks and days, and **PL stages as they come (the hatchery states the stage;
  we never guess it). The counter behaves differently for larger larvae (see docs/exception-cases.md), so include PL11 to PL14 and
  at least two different trays of each stage.**
- Some trays photographed on purpose in the way a busy worker would (a little tilted, some glare) so we learn how forgiving it is.
- Two people counting by hand: one person's hand count is uncertain by several percent, and we cannot look more accurate
  than the hand counts agree with each other.

## Getting the result

In the app: More, Count history, set the dates, Download CSV. Then on the computer:

    python eval/field_test_report.py counts.csv

It prints, only where the numbers exist: the automatic count versus the hand count, the count after the operator's corrections
versus the hand count, the other app versus the hand count, and the automatic count versus the other app. With fewer than about
15 trays it says the percentages are too few to trust. It never invents a figure.

## What we do with it

- If the average error is small and there is no strong bias, we can say so, with the number of trays it rests on.
- If it reads low on crowded trays, that is the overlap limit (docs/exception-cases.md), and the next step is labelling those photos.
- Photos from this test, with their hand counts, are also what a trained detector needs. Keep the originals.

## Improving accuracy with corrected marks (added 2026-09-21)

Every counted photo (AI counts only) is stored on the phone with the counter's marks and the person's corrections: marks they
added (larvae the counter missed), marks they removed (wrong marks), and marks outside the water outline.

1. Count a tray as usual. Fix the marks properly before saving: every larva missed, every wrong mark. The photos are only
   useful as truth if the corrections are careful. Enter the hand count too when there is one.
2. More, then "Export corrected marks". This saves one .zip file. Send it over (WhatsApp is fine).
3. Score it: `python eval/score_labels.py path/to/file.zip`. It re-runs the current counter on each photo and reports recall
   (larvae found), precision (marks that were real) and the count error against the corrected marks.
4. The same file is the training data for a learned detector later. Aim for 3-5 carefully corrected trays per PL stage, and
   keep some trays back to test on, so results are not tuned on the same trays they are measured on.

Limits: the truth is only as good as the person's corrections, and one person's eyes. State how many trays a result covers.
