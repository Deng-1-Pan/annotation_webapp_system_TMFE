#!/usr/bin/env python3
"""Build frontend/backend import bundles for the TMFE annotation webapp.

Inputs (read-only):
- outputs/annotation_samples/*.csv
- outputs/features/parsed_transcripts.parquet
- outputs/features/sentences_with_keywords.parquet

Outputs (inside annotation_webapp_system_TMFE):
- data_import/generated/task_items/*.jsonl
- data_import/generated/transcript_contexts/{doc_id}.json
- data_import/generated/sentence_keyword_snippets.json
- data_import/generated/seed_snapshot.json
- data_import/generated/import_summary.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd

TASK_FILES = {
    'ai_sentence_audit': 'ai_sentence_audit.csv',
    'role_audit_qa_turns': 'role_audit_qa_turns.csv',
    'qa_boundary_audit_docs': 'qa_boundary_audit_docs.csv',
    'initiation_audit_exchanges': 'initiation_audit_exchanges.csv',
}


def to_jsonable(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, 'item'):
        try:
            return value.item()
        except Exception:
            pass
    if isinstance(value, (list, tuple)):
        return [to_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    return value


def normalize_turns(turns: Any, section: str) -> list[dict[str, Any]]:
    if turns is None or (isinstance(turns, float) and pd.isna(turns)):
        return []
    if hasattr(turns, 'tolist') and not isinstance(turns, list):
        turns = turns.tolist()
    out: list[dict[str, Any]] = []
    for idx, turn in enumerate(turns or []):
        if isinstance(turn, dict):
            record = {str(k): to_jsonable(v) for k, v in turn.items()}
        else:
            record = {'text': str(turn)}
        record.setdefault('idx', int(record.get('turn_idx', record.get('idx', idx))))
        record.setdefault('speaker', str(record.get('speaker', '')))
        record.setdefault('text', str(record.get('text', '')))
        record['section'] = section
        if 'is_question' in record:
            record['isQuestion'] = bool(record.pop('is_question'))
        if 'role' in record and record['role'] is None:
            record['role'] = 'unknown'
        out.append(record)
    return out


def build_doc_id(ticker: str, year: Any, quarter: Any) -> str:
    return f"{ticker}_{int(year)}Q{int(quarter)}"


def load_task_items(annotation_samples_dir: Path) -> tuple[dict[str, list[dict[str, Any]]], set[str]]:
    task_rows: dict[str, list[dict[str, Any]]] = {}
    doc_ids: set[str] = set()
    for task_type, filename in TASK_FILES.items():
        path = annotation_samples_dir / filename
        df = pd.read_csv(path)
        rows: list[dict[str, Any]] = []
        for _, row in df.iterrows():
            raw = {str(k): to_jsonable(v) for k, v in row.to_dict().items()}
            sample_id = str(raw['sample_id'])
            doc_id = str(raw['doc_id'])
            record = {
                'id': f"ti-{task_type}-{sample_id}",
                'taskType': task_type,
                'sampleId': sample_id,
                'docId': doc_id,
                'payload': raw,
                'createdAt': None,
            }
            rows.append(record)
            doc_ids.add(doc_id)
        task_rows[task_type] = rows
    return task_rows, doc_ids


def subset_parsed_transcripts(path: Path, doc_ids: set[str]) -> dict[str, dict[str, Any]]:
    cols = ['ticker', 'date', 'quarter', 'year', 'speech_turns', 'qa_turns']
    df = pd.read_parquet(path, columns=cols)
    contexts: dict[str, dict[str, Any]] = {}
    for _, row in df.iterrows():
        ticker = str(row['ticker'])
        doc_id = build_doc_id(ticker, row['year'], row['quarter'])
        if doc_id not in doc_ids:
            continue
        speech_turns = normalize_turns(row.get('speech_turns'), 'speech')
        qa_turns = normalize_turns(row.get('qa_turns'), 'qa')
        # Assign global absolute indices so speech turns [0..N-1] always
        # precede QA turns [N..N+M-1] in the merged sequence.
        for i, turn in enumerate(speech_turns):
            turn['idx'] = i
        offset = len(speech_turns)
        for i, turn in enumerate(qa_turns):
            turn['idx'] = offset + i
        merged_turns = speech_turns + qa_turns  # already in correct order
        contexts[doc_id] = {
            'docId': doc_id,
            'ticker': ticker,
            'year': int(row['year']),
            'quarter': int(row['quarter']),
            'speechTurns': speech_turns,
            'qaTurns': qa_turns,
            'mergedTurns': merged_turns,
            'sourceDate': to_jsonable(row.get('date')),
        }
    return contexts


def subset_keyword_sentences(path: Path, doc_ids: set[str], max_per_doc: int = 50) -> dict[str, Any]:
    cols = ['doc_id', 'section', 'speaker', 'turn_idx', 'sentence_idx', 'kw_is_ai', 'text']
    try:
        df = pd.read_parquet(path, columns=cols, filters=[('doc_id', 'in', list(doc_ids))])
    except Exception:
        df = pd.read_parquet(path, columns=cols)
        df = df[df['doc_id'].isin(doc_ids)]

    df = df.sort_values(['doc_id', 'turn_idx', 'sentence_idx'])
    out: dict[str, Any] = {}
    for doc_id, g in df.groupby('doc_id', sort=False):
        ai_hits = g[g['kw_is_ai'] == True].head(max_per_doc)  # noqa: E712
        out[str(doc_id)] = {
            'total_sentences_subset': int(len(g)),
            'kw_ai_hit_count_subset': int(g['kw_is_ai'].fillna(False).sum()),
            'kw_ai_hit_examples': [
                {
                    'section': to_jsonable(r['section']),
                    'speaker': to_jsonable(r['speaker']),
                    'turn_idx': to_jsonable(r['turn_idx']),
                    'sentence_idx': to_jsonable(r['sentence_idx']),
                    'text': to_jsonable(r['text']),
                }
                for _, r in ai_hits.iterrows()
            ],
        }
    return out


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
      for row in rows:
        f.write(json.dumps(row, ensure_ascii=False) + '\n')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo-root', default='..', help='Path from annotation_webapp_system_TMFE/ to repository root')
    parser.add_argument('--skip-sentences', action='store_true', help='Skip sentences_with_keywords.parquet subset extraction')
    args = parser.parse_args()

    here = Path(__file__).resolve().parents[1]  # annotation_webapp_system_TMFE/
    repo_root = (here / args.repo_root).resolve()
    annotation_samples_dir = repo_root / 'outputs' / 'annotation_samples'
    features_dir = repo_root / 'outputs' / 'features'
    out_dir = here / 'data_import' / 'generated'

    task_rows, doc_ids = load_task_items(annotation_samples_dir)

    parsed_path = features_dir / 'parsed_transcripts.parquet'
    sentence_path = features_dir / 'sentences_with_keywords.parquet'
    try:
        contexts = subset_parsed_transcripts(parsed_path, doc_ids)
    except ImportError as exc:
        raise SystemExit(
            "Parquet support missing. Install one engine, e.g. `python3 -m pip install pyarrow` "
            "or `python3 -m pip install fastparquet`."
        ) from exc
    missing_doc_ids = sorted(doc_ids - set(contexts))

    if args.skip_sentences:
        sentence_snippets = {}
    else:
        try:
            sentence_snippets = subset_keyword_sentences(sentence_path, doc_ids)
        except ImportError as exc:
            raise SystemExit(
                "Parquet support missing for sentences_with_keywords.parquet. "
                "Install `pyarrow` or `fastparquet`."
            ) from exc

    (out_dir / 'task_items').mkdir(parents=True, exist_ok=True)
    for task_type, rows in task_rows.items():
        write_jsonl(out_dir / 'task_items' / f'{task_type}.jsonl', rows)

    ctx_dir = out_dir / 'transcript_contexts'
    ctx_dir.mkdir(parents=True, exist_ok=True)
    for doc_id, ctx in contexts.items():
        write_json(ctx_dir / f'{doc_id}.json', ctx)

    seed_snapshot = {
        'users': [],
        'taskConfigs': [],
        'taskItems': [row for rows in task_rows.values() for row in rows],
        'transcriptContexts': contexts,
        'claims': [],
        'annotations': [],
        'adjudications': [],
    }
    write_json(out_dir / 'seed_snapshot.json', seed_snapshot)
    write_json(out_dir / 'sentence_keyword_snippets.json', sentence_snippets)
    write_json(
        out_dir / 'import_summary.json',
        {
            'task_counts': {k: len(v) for k, v in task_rows.items()},
            'doc_ids_total': len(doc_ids),
            'doc_contexts_found': len(contexts),
            'doc_contexts_missing': missing_doc_ids,
            'sentences_subset_generated': not args.skip_sentences,
            'output_dir': str(out_dir),
        },
    )
    print(json.dumps({'status': 'ok', 'output_dir': str(out_dir), 'missing_doc_ids': missing_doc_ids}, ensure_ascii=False))


if __name__ == '__main__':
    main()
