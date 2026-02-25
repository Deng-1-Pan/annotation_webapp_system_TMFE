# TMFE Annotation Webapp Design (Implemented MVP)

Goal: Build a multi-user annotation webapp with double-annotation progress semantics, adjudication UI, context-enhanced role/boundary annotation, and CSV export compatible with existing templates.

Architecture:
- React + TypeScript frontend (Vite, deployable to GitHub Pages)
- Supabase schema/seed for shared persistence
- Python import/preprocess script for CSV+Parquet -> JSON bundles
- Mock service fallback for local demo without backend credentials

Notes:
- Task completion uses `double_annotated_count` (formal annotators only)
- Coverage for role/initiation uses adjudicated labels only
- `annotator_a` / `annotator_b` are export slots, not fixed people
- `Deng Pan` supports `test` and `adjudicator` modes
