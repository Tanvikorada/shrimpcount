"""Compare predicted vs manual counts on the held-out split. The only source of accuracy numbers.

Input CSV columns: image_file, manual_count, predicted_count   (one row per test image)
Outputs: printed MAE / MAPE / bias overall and per density bucket, plus eval/out/bland_altman.png
         and eval/out/worst20.csv.

Density buckets default to terciles of manual_count. Replace with --edges once the hatchery agrees cutoffs.
Usage: python eval/evaluate_counts.py counts.csv [--edges 100 300] [--target-mape 5]
"""
import argparse
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def metrics(df: pd.DataFrame) -> dict:
    err = df["predicted_count"] - df["manual_count"]
    ape = err.abs() / df["manual_count"].replace(0, np.nan) * 100
    return {"n": len(df), "MAE": round(float(err.abs().mean()), 2),
            "MAPE_%": round(float(ape.mean()), 2), "bias": round(float(err.mean()), 2)}


def bucketise(df: pd.DataFrame, edges) -> pd.Series:
    if edges:
        bins = [-np.inf, *edges, np.inf]
        labels = [f"b{i + 1}" for i in range(len(bins) - 1)]
    else:
        bins = [-np.inf, *df["manual_count"].quantile([1 / 3, 2 / 3]).tolist(), np.inf]
        labels = ["low", "medium", "high"]
    return pd.cut(df["manual_count"], bins=bins, labels=labels)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("counts_csv")
    ap.add_argument("--edges", type=float, nargs="*", default=None)
    ap.add_argument("--target-mape", type=float, default=None)
    ap.add_argument("--out", default="eval/out")
    args = ap.parse_args()

    df = pd.read_csv(args.counts_csv).dropna(subset=["manual_count", "predicted_count"])
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    df["bucket"] = bucketise(df, args.edges)

    overall = metrics(df)
    print("OVERALL", overall)
    for name, g in df.groupby("bucket", observed=True):
        print(f"{name:>8}", metrics(g))

    if args.target_mape is not None:
        verdict = "MEETS" if overall["MAPE_%"] <= args.target_mape else "DOES NOT MEET"
        print(f"Target MAPE {args.target_mape}%: {verdict} (got {overall['MAPE_%']}%)")

    # Bland-Altman
    mean = (df["predicted_count"] + df["manual_count"]) / 2
    diff = df["predicted_count"] - df["manual_count"]
    md, sd = diff.mean(), diff.std(ddof=1) if len(diff) > 1 else 0.0
    plt.figure(figsize=(6, 4))
    plt.scatter(mean, diff, s=14)
    for y, style in ((md, "-"), (md + 1.96 * sd, "--"), (md - 1.96 * sd, "--")):
        plt.axhline(y, color="gray", linestyle=style)
    plt.xlabel("Mean of predicted and manual count")
    plt.ylabel("Predicted - manual")
    plt.title("Bland-Altman")
    plt.tight_layout()
    plt.savefig(out / "bland_altman.png", dpi=150)

    df["abs_err"] = diff.abs()
    df.sort_values("abs_err", ascending=False).head(20).to_csv(out / "worst20.csv", index=False)
    print(f"Wrote {out / 'bland_altman.png'} and {out / 'worst20.csv'}")


if __name__ == "__main__":
    main()
