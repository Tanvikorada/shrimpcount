# Labeling Guide v0.1

Tool: Roboflow (free tier) or CVAT. Single class: `larva`.

## Definition
Label **one box per individual postlarva** that is visible in the tray image.

## Rules for hard cases (decide once, apply always)
| Situation | Rule |
|---|---|
| Two larvae touching | Two boxes, one each |
| Overlapping, both distinguishable | Two boxes (boxes may overlap) |
| Overlapping so badly that the count is a guess | Best-estimate count of boxes. Add the image to a `hard` list in the manifest notes |
| Larva cut by the tray edge | Label only if more than ~50% is visible inside the tray |
| Larva on/under the rim or ruler | Do not label |
| Debris, feces, molts, bubbles | Do not label |
| Very faint / out-of-focus larva | Label if you would count it manually, otherwise skip. Be consistent with the manual counting rule |
| Dead/curled larva | Label (count as larva) unless the hatchery says otherwise. **Confirm this with the partner** |

Box tightly around the body. Do not include the full antenna or tail whip if it makes the box loose.

## Workflow
1. Label the first ~50 images by hand (spread across batches and density buckets).
2. Train a quick model, then use model-assisted pre-labels for the rest. Review and correct every image.
3. Sanity check: the number of boxes in each image should be close to `manual_count_a`. Flag any image where they differ by more than ~10% and re-check both.
4. Keep this guide versioned. If a rule changes, relabel or note the affected images.

## Split
Split by `batch_id`, roughly 70/15/15 train/val/test. No batch appears in more than one split. Keep the test split untouched until final evaluation.
