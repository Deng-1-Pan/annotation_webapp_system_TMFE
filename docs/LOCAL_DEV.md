# Local Development

## 1. Frontend (mock mode, no backend required)

```bash
cd annotation_webapp_system_TMFE/web
cp .env.example .env.local
npm install
npm run dev
```

Default `VITE_DATA_MODE=mock` will use browser `localStorage` for demo-only local state.

## 2. Frontend (Supabase mode)

Set in `web/.env.local`:

```env
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Then run:

```bash
npm run dev
```

## 3. Import / Preprocess Data Bundles

Parquet support requires one engine: `pyarrow` or `fastparquet`. Example:

```bash
python3 -m pip install pyarrow
```

Then run:

```bash
cd annotation_webapp_system_TMFE
python3 scripts/build_import_bundle.py --repo-root ..
```

## 3.1 Export annotation sample CSVs + full call script sidecars (upstream generator)

The upstream exporter now also writes full earnings-call script sidecars for role/boundary tasks:
- `role_audit_qa_turns_full_call_contexts.jsonl`
- `qa_boundary_audit_docs_full_call_contexts.jsonl`

Example (export directly into this webapp folder for GitHub packaging):

```bash
cd /Users/pandeng/Desktop/ICBS\ FinTech/Term\ 2/Text\ Mining\ for\ Economics/code/CW
python3 scripts/export_annotation_samples.py \
  --output-dir annotation_webapp_system_TMFE/data_assets/annotation_samples
```

If you plan to commit large generated data files, install Git LFS and the subtree rule file in
`annotation_webapp_system_TMFE/.gitattributes` will apply:

```bash
git lfs install
```

Output files are written to `annotation_webapp_system_TMFE/data_import/generated/`.

If you want a faster dry run without `sentences_with_keywords.parquet`:

```bash
python3 scripts/build_import_bundle.py --repo-root .. --skip-sentences
```

## 4. Tests and Build

```bash
cd annotation_webapp_system_TMFE/web
npm test
npm run build
```
