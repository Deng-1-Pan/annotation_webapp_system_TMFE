# annotation_webapp_system_TMFE

TMFE course project annotation system (frontend + Supabase schema + data import script) for collaborative manual audit of:
- AI sentence identification
- Q&A role classification
- Q&A boundary/pairing quality
- AI initiation labels

## Directory Overview

- `web/` React + TypeScript frontend (Vite)
- `supabase/` SQL schema + seed config
- `scripts/` import/preprocess utilities
- `.gitattributes` Git LFS rules scoped to this subtree (generated data bundles / packaged assets)
- `data_import/generated/` generated JSON bundles (created by script)
- `data_assets/` optional packaged annotation sample exports / context sidecars for GitHub sharing
- `docs/` local run / deployment / Supabase setup docs

## Quick Start (demo)

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Default mode is `mock` for local demo. For shared multi-user persistence, switch to `Supabase` mode (`VITE_DATA_MODE=supabase`) and apply SQL in `supabase/`.

## Required Semantics Implemented

- Task completion = double-annotated by two different formal annotators
- Coverage (role/initiation) = adjudicated labels only
- `Deng Pan` supports `test` and `adjudicator`
- A/B slots are export-time slots (first two formal submissions by stable order)
- Batch claim prioritizes `single_only` then `zero_annotated` and avoids self-repeat
