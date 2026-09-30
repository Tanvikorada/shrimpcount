# Exception cases: what can go wrong when counting larvae from a photo

Written from (a) the first 20 real photos from the pilot hatchery, (b) a stress test with known counts, and (c) published
work on shrimp-larvae counting. **No accuracy is claimed anywhere here.** Accuracy needs manual counts of real trays.

## What the literature says (short)

- Overlap is the central problem: larvae at different water depths line up in the photo, and classical image methods degrade
  sharply when they overlap. Published fixes are trained detectors with position/shape information, splitting the photo
  into overlapping tiles, and density-map regression; density maps mis-judge in very crowded areas.
  ([Sensors 2024, improved YOLOv5 with regional segmentation](https://doi.org/10.3390/s24196328),
  [SLCOBNet, overlapping splitting](https://www.sciencedirect.com/science/article/abs/pii/S1537511024001429),
  [density-map regression](https://link.springer.com/article/10.1007/s10499-023-01316-z),
  [industrial-farm shrimp counting](https://www.sciencedirect.com/science/article/pii/S0959652624024739))
- Published accuracies (for example "over 98%") come from each group's own photos and their own manual counts. They do not
  transfer to the pilot hatchery's trays, and we do not quote them as ours.
- Trained detectors need many labelled photos of many *different* trays. We have about 20 photos of one or two trays, so
  we cannot train one yet. That is the honest reason the counter is still a classical, tuned-by-eye baseline.

## The cases, and what the app does about each

| Case | What we saw | Handled by | Status |
|---|---|---|---|
| Dark marks that are **not larvae**: corner tags, QR label, wall bevels, dry tray edge | Real bug: the first counter marked 34-300 spots on the wall and corners of one photo | **Tray outline, fitted to each photo.** Starts from a standard octagon and slides each edge onto the real tray edge (searching only a narrow band). Only the water is counted; marks outside are shown faint. On the 20 photos it recovered about 25 real larvae per photo that the fixed octagon cut off (150 on the closer-framed photo) and left out about 77 wall marks. The operator can still drag the corners, and named trays are saved | Fixed and checked on 20 photos of one tray type. Needs a check on each new tray type |
| Flash reflection | A mark landed on the reflection itself; faint larvae inside the halo are missed | Marks on saturated pixels are ignored and the operator is told how many, to check by eye | Partly handled. Larvae hidden under glare are still invisible: retake with the light moved |
| **Overlapping / touching larvae** | Where 3-4 cross, 2 marks appear | **Hidden-larvae estimate:** a spot with 2.4x or more the dark mass of a typical single larva is counted as several, and the extra marks are placed beside it and shown as estimates the operator can remove. Stress test: reads about 6% low at 5,000 per tray instead of 17% low | **Partly handled.** It sees clumps of about three or more with heads a few pixels apart. It cannot see two larvae on exactly the same spot (transparent bodies darken the image only about 1.5x). Needs a trained detector or a second photo for that |
| Very crowded tray | Same as above, growing with density | Warning above about 3,500 marks: "very crowded, count may read low, use a smaller sample" | Handled by the estimate above plus guidance |
| Tails counted as larvae | The first counter overcounted about 2x | Count the head/gut spot, not the streak. Round-shape gate for faint spots | Fixed for these photos |
| Faint / pale larvae | Some heads under 6 grey levels are missed | Weak-but-round spots are admitted; the rest is missed | Open (reads low) |
| Dead, moulted or lying larvae, debris, faeces, feed, bubbles | Not enough examples in the 20 photos to see | Operator can tap to remove or add a mark. Not detected automatically | Open. Needs photos that contain these |
| Different stage (PL size), species, pigment | **Measured on a PL14 tray: the fine settings (tuned on PL10) marked one animal 2-3 times and read 19.5% above the reference count.** Larger larvae carry two eye dots, a head spot and a gut spot | A **larva size** choice, Small or Large, that starts from the PL stage the hatchery wrote on the batch and can be changed on each count. "Large" read +1.3% on that tray with 2.8% spread | **Partly handled.** Chosen after seeing that tray's reference count, so it needs a second PL14 tray to confirm. PL11-PL13 unseen. A trained, animal-level detector is the real fix |
| Different tray, camera, height, colour of light | Framing differed even within the 20 photos (one is zoomed closer) | Fixed working width, tray outline profile, capture checks (light, glare, level) | Needs a check on each setup |
| Photo-to-photo variation | About 4.4% spread between repeat shots of one tray | Repeat photos of one tray are averaged (expected about 2.6% for 3 shots) | Handled |
| Live larvae moving / motion blur | Not present in the photos | Capture guidance: settle the tray, hold flat | Untested |

## Automatic tray detection was tried and rejected

Three automatic ways to find the water area were tried on the 20 photos: edge rays from the centre, flood fill, and colour
segmentation. None was reliable across framings, and two versions cut off real larvae at the tray edges. Cutting off real
larvae is worse than counting a few wall marks, so the outline is set by a person. The reference app's thumbnails show the same
idea: marks only inside an octagonal tray floor, with the corner tags left out.

## The stress test (`eval/stress_test.py`)

Real isolated larvae are cut from the photos and pasted with their real translucency onto the empty tray background at
chosen densities, so the true count is known. **It is synthetic. It shows where the counter breaks, not how accurate the
product is.** Latest run: 71 larvae cut from 12 photos, peak window 5, glare ignored, tray outline on, 2 seeds.

| True count in the picture | Without hidden-larvae estimate | With it (default) |
|---|---|---|
| 800 | -0.4% | 0.0% |
| 1,700 | -4.6% | -2.0% |
| 3,000 | -9.5% | -3.8% |
| 5,000 | -17.0% | -5.9% |

How much to trust this:
- The setting (ratio 2.4) was chosen on one half of the pasted larvae and checked on the other half. On the held-out half it
  was within about 1% at every density; on the tuning half it was 6-7% low at 5,000. Lower ratios overshoot on some
  larvae (heavier individuals are counted as two, +4% at 800), so 2.4 is the cautious end.
- On the real photos it adds only about 1 mark per photo on average (0 to 5), moving the mean by about 0.1%. It matters
  for crowded trays and is nearly invisible on normal ones.
- Random placement is more even than a real tray, and the pasted larvae repeat. Treat the trend as the finding, not the digits.
- A real check needs manual counts of dense trays.

## What would fix the open items

1. Manual counts for 15–30 distinct trays (with the reference app's count for each) to measure real accuracy and any bias.
2. Photos that contain the awkward cases (dead larvae, debris, bubbles, other stages, a very dense tray) to label them.
3. Then train a detector on tiles of those photos (`training/`), and compare it with this baseline on held-out trays.


## Looked at and rejected: "maybe" candidates for faint larvae (2026-09-21)

Lowering the thresholds to also show borderline spots as tap-to-accept "maybe" rings was tried. Looking at 153 extra candidates
on one photo at 3x, almost all sat on stains and mottled water, not on larvae, so the feature would waste an operator's taps
and was not built. On sparse areas the counter already marks nearly every larva that has a visible head. What remains is mostly
overlap (see above) and larvae with no distinct head, which need a trained detector.
