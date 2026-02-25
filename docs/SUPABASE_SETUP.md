# Supabase Setup

## 1. Create project

Create a Supabase project and copy:
- Project URL
- Anon public key

## 2. Apply schema and seed

Run in Supabase SQL Editor:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

## 3. Import task items and transcript contexts

Run preprocessing locally:

```bash
cd annotation_webapp_system_TMFE
python3 scripts/build_import_bundle.py --repo-root ..
```

Then import generated JSON/JSONL into tables:
- `task_items`
- `transcript_docs`

Recommended approach:
- use Supabase Table Editor for small demos
- or write a one-off Python uploader script (not included in this MVP)

## 4. RLS note

This MVP schema enables broad demo policies (`using (true)`). For production usage, replace with authenticated policies.
