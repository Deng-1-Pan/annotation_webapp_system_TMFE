#!/usr/bin/env python3
"""Upload generated task_items and transcript_docs to Supabase.

Prerequisites:
  python3 scripts/build_import_bundle.py --repo-root ..

Usage:
  python3 scripts/upload_to_supabase.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install requests")

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
GENERATED_DIR = PROJECT_ROOT / "data_import" / "generated"
ENV_PRODUCTION = PROJECT_ROOT / "web" / ".env.production"

BATCH_SIZE_ITEMS = 200      # task_items are small
BATCH_SIZE_DOCS = 20        # transcript_docs have large JSON payloads


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_env() -> dict[str, str]:
    """Read VITE_ vars from .env.production."""
    env: dict[str, str] = {}
    if not ENV_PRODUCTION.exists():
        sys.exit(f"Missing {ENV_PRODUCTION}. Create it with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
    for line in ENV_PRODUCTION.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


def supabase_headers(anon_key: str) -> dict[str, str]:
    return {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }


# ---------------------------------------------------------------------------
# Transform: camelCase JSONL/JSON → snake_case DB rows
# ---------------------------------------------------------------------------

def transform_task_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "task_type": item["taskType"],
        "sample_id": item["sampleId"],
        "doc_id": item["docId"],
        "payload_json": item["payload"],
    }


def transform_transcript_doc(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "doc_id": doc["docId"],
        "ticker": doc.get("ticker"),
        "year": doc.get("year"),
        "quarter": doc.get("quarter"),
        "source_date": doc.get("sourceDate"),
        "speech_turns_json": doc.get("speechTurns", []),
        "qa_turns_json": doc.get("qaTurns", []),
        "merged_turns_json": doc.get("mergedTurns", []),
    }


# ---------------------------------------------------------------------------
# Load generated files
# ---------------------------------------------------------------------------

def load_task_items() -> list[dict[str, Any]]:
    items_dir = GENERATED_DIR / "task_items"
    rows: list[dict[str, Any]] = []
    for jsonl_file in sorted(items_dir.glob("*.jsonl")):
        for line in jsonl_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                rows.append(transform_task_item(json.loads(line)))
    return rows


def load_transcript_docs() -> list[dict[str, Any]]:
    ctx_dir = GENERATED_DIR / "transcript_contexts"
    rows: list[dict[str, Any]] = []
    for json_file in sorted(ctx_dir.glob("*.json")):
        doc = json.loads(json_file.read_text(encoding="utf-8"))
        rows.append(transform_transcript_doc(doc))
    return rows


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def upsert_batch(
    base_url: str,
    headers: dict[str, str],
    table: str,
    rows: list[dict[str, Any]],
    batch_size: int = 200,
    dry_run: bool = False,
) -> int:
    """Upsert rows in batches. Returns total upserted count."""
    total = 0
    url = f"{base_url}/rest/v1/{table}"

    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        if dry_run:
            print(f"  [DRY-RUN] Would upsert {len(batch)} rows to {table} (batch {i // BATCH_SIZE + 1})")
            total += len(batch)
            continue

        resp = requests.post(url, headers=headers, json=batch, timeout=60)
        if resp.status_code in (200, 201):
            total += len(batch)
            print(f"  Upserted {len(batch)} rows to {table} (batch {i // batch_size + 1})")
        else:
            print(f"  ERROR uploading to {table}: {resp.status_code} {resp.text[:500]}", file=sys.stderr)
            sys.exit(1)

    return total


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def ensure_generated_data() -> None:
    """Run build_import_bundle.py if generated data is missing."""
    items_dir = GENERATED_DIR / "task_items"
    if not items_dir.exists() or not list(items_dir.glob("*.jsonl")):
        print("Generated data not found. Running build_import_bundle.py ...")
        result = subprocess.run(
            [sys.executable, str(HERE / "build_import_bundle.py"), "--repo-root", ".."],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            sys.exit(f"build_import_bundle.py failed with code {result.returncode}")
        print(f"  Bundle generated: {result.stdout.strip()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload annotation data to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be uploaded without sending requests")
    args = parser.parse_args()

    ensure_generated_data()

    env = load_env()
    base_url = env.get("VITE_SUPABASE_URL", "").rstrip("/")
    anon_key = env.get("VITE_SUPABASE_ANON_KEY", "")
    if not base_url or not anon_key:
        sys.exit("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in .env.production")

    headers = supabase_headers(anon_key)

    # -- transcript_docs first (task_items reference doc_id) --
    print("\n=== Uploading transcript_docs ===")
    docs = load_transcript_docs()
    print(f"  Loaded {len(docs)} transcript docs")
    docs_count = upsert_batch(base_url, headers, "transcript_docs", docs, batch_size=BATCH_SIZE_DOCS, dry_run=args.dry_run)

    # -- task_items --
    print("\n=== Uploading task_items ===")
    items = load_task_items()
    print(f"  Loaded {len(items)} task items")
    items_count = upsert_batch(base_url, headers, "task_items", items, batch_size=BATCH_SIZE_ITEMS, dry_run=args.dry_run)

    # -- Summary --
    print(f"\n{'[DRY-RUN] ' if args.dry_run else ''}Done!")
    print(f"  transcript_docs: {docs_count}")
    print(f"  task_items:      {items_count}")


if __name__ == "__main__":
    main()
