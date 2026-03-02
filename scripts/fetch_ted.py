"""Fetch TED Talks transcripts from Hugging Face and save as sample CSV."""

import csv
import sys
from pathlib import Path

csv.field_size_limit(sys.maxsize)

OUT_PATH = Path(__file__).resolve().parent.parent / "sample" / "ted-talks.csv"
FIELDNAMES = ["title", "main_speaker", "tags", "published_date", "transcript"]


def main() -> None:
    from datasets import load_dataset

    print("Loading FrancophonIA/TED_talks (EN) from Hugging Face ...")
    ds = load_dataset("FrancophonIA/TED_talks", "EN", split="train")
    print(f"  {len(ds)} talks loaded")

    rows: list[dict[str, str]] = []
    for item in ds:
        raw_topics = item.get("topics") or []
        if isinstance(raw_topics, (list, tuple)):
            topics: list[str] = [str(t).strip() for t in raw_topics]
        elif isinstance(raw_topics, str):
            # Handle stringified list like "['a', 'b']"
            cleaned = raw_topics.strip("[] ")
            topics = [t.strip().strip("'\"") for t in cleaned.split(",") if t.strip()]
        else:
            topics = []
        tags_str = ",".join(["TED"] + topics) if topics else "TED"
        transcript = (item.get("transcript") or "").strip()
        if not transcript:
            continue
        rows.append(
            {
                "title": (item.get("title") or "").strip(),
                "main_speaker": (item.get("speaker_1") or "").strip(),
                "tags": tags_str,
                "published_date": (item.get("published_date") or "").strip(),
                "transcript": transcript,
            }
        )

    # Sort by published_date ascending
    rows.sort(key=lambda r: r["published_date"])

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Saved {len(rows)} rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
