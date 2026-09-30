# Capture Protocol v0.1 (DRAFT: confirm with the pilot hatchery)

Goal: every image is taken the same way, so the model learns larvae, not lighting quirks. Consistency matters more than image quality.

## 1. Rig (fixed for the whole dataset)
| Item | Spec | Agreed value |
|---|---|---|
| Container | Shallow white (or clear on white) tray, flat bottom | ______ |
| Background | White, or a backlit light-box / LED panel under a clear tray | ______ |
| Water depth | Fixed, as shallow as possible (larvae should not stack vertically). Mark the level on the tray | ___ mm |
| Camera height | Fixed by a stand / tripod / rigid arm, lens parallel to tray | ___ cm |
| Camera | Same phone for the whole dataset, fixed zoom (no digital zoom), fixed orientation | ______ |
| Lighting | Diffuse, even, no glare. Avoid direct overhead point lights and window light | ______ |
| Reference | Ruler or printed marker (e.g. 10 cm scale) in the frame edge, same place every time | ______ |
| Sample size | Fixed volume per sample, or fixed and recorded (e.g. 100 mL) | ___ mL |

## 2. Phone settings
- Native resolution, highest quality. JPEG or HEIC is fine, but do not use "beauty", HDR or portrait modes.
- Lock focus and exposure (tap-and-hold) on the tray surface. Take the same shot each time.
- Flash off.
- No editing, cropping, resizing or compressing. Archive originals untouched.

## 3. Per-sample procedure
1. Gently stir the source container, then draw the sample in one motion (do not cherry-pick).
2. Pour into the tray to the marked water level. Let the water settle 5-10 s to avoid ripples.
3. Spread larvae with a soft, gentle motion. Avoid piles. Record whether they were spread or not.
4. Check for glare, bubbles and debris. Remove bubbles. Do not remove larvae.
5. Capture 1 image (optionally 2-3 repeats, marked as repeats in `notes`).
6. Manually count the same tray, ideally from the photo on a screen (see §5). Record it.

## 4. Coverage targets
- 200-300+ images minimum.
- At least 3 density buckets: **low** (< ~100), **medium**, **high** (agree the cutoffs with the hatchery before shooting), and roughly balanced.
- Several batches (at least 5 if possible), and different PL stages if available.
- Some deliberately hard images: overlap, mild debris, slightly different lighting. Mark these in `notes`.

## 5. Ground truth
- Count from the **photo** (zoom on a screen and tick off each larva), not from the live tray. That way the count matches the image exactly.
- `manual_count_a`: filled for every image.
- `manual_count_b`: a second, independent counter (who has not seen A's number) on at least 30 images, spanning all density buckets.
- Human disagreement between A and B sets the realistic accuracy ceiling.

## 6. Files and naming
```
data/raw/<batch_id>/<batch_id>_S<3-digit sample no>.jpg
e.g. data/raw/B03/B03_S017.jpg
```
- Keep originals in per-batch folders. Back up to a drive outside git.
- One row per image in `data/manifest.csv`.

## 7. manifest.csv columns
| Column | Meaning |
|---|---|
| `image_file` | Path relative to `data/raw/`, e.g. `B03/B03_S017.jpg` |
| `batch_id` | e.g. `B03` (used for the train/val/test split, so it must be accurate) |
| `pl_stage` | e.g. `PL10`, `PL12` |
| `manual_count_a` | Counter A's total |
| `manual_count_b` | Counter B's total (blank if not double-counted) |
| `notes` | Density guess, repeat shot, glare, debris, anything unusual |

Sample date and counter names can go in `notes` for now. Add columns later if needed. Do not rename existing ones.

## 8. Open questions for the hatchery
1. Accuracy target (MAPE) they consider acceptable? Draft: ≤ 5%.
2. Typical counts per sample, and the density cutoffs for low/medium/high.
3. Which PL stages and how many batches are available in the next 2-3 weeks?
4. Who can act as counter B?
5. Is the data allowed to be used for training and shown in a case study (a written OK)?

## 9. Exit checklist (Phase 0 is done when all are ticked)
- [ ] Rig values in §1 agreed and written down
- [ ] Accuracy target agreed in writing
- [ ] 200-300+ images captured to protocol
- [ ] `manifest.csv` filled, with manual_count_b on ≥ 30 images
- [ ] Originals backed up, unmodified
- [ ] Data-use permission recorded
