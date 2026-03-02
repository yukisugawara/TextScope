"""Fetch SOTU transcripts from GitHub and save as sample CSV."""

import csv
import io
import sys
import urllib.request
from pathlib import Path

csv.field_size_limit(sys.maxsize)

RAW_URL = (
    "https://raw.githubusercontent.com/BrianWeinstein/"
    "state-of-the-union/master/transcripts.csv"
)
OUT_PATH = Path(__file__).resolve().parent.parent / "sample" / "SOTU.csv"


def main() -> None:
    print(f"Downloading from {RAW_URL} ...")
    with urllib.request.urlopen(RAW_URL) as resp:
        raw = resp.read().decode("utf-8")

    reader = csv.DictReader(io.StringIO(raw))
    rows: list[dict[str, str]] = []
    for row in reader:
        president = row.get("president", "").strip()
        rows.append(
            {
                "title": row.get("title", "").strip(),
                "main_speaker": president,
                "tags": f"SOTU,State of the Union,{president}",
                "published_date": row.get("date", "").strip(),
                "transcript": row.get("transcript", "").strip(),
            }
        )

    # Sort by published_date ascending
    rows.sort(key=lambda r: r["published_date"])

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["title", "main_speaker", "tags", "published_date", "transcript"],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Saved {len(rows)} rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
