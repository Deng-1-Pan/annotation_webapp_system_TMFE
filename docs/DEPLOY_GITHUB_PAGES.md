# GitHub Pages Deployment (Frontend) + Supabase (Backend)

## Why this architecture

GitHub Pages can host the React frontend but **cannot provide shared writes** for multi-user annotation progress. Use Supabase for shared persistence.

## Build config notes

- Vite app is in `annotation_webapp_system_TMFE/web`
- For GitHub Pages project site, set Vite `base` if needed (e.g. `/REPO_NAME/`)
- Inject `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions secrets

## Example GitHub Actions workflow (summary)

1. `cd annotation_webapp_system_TMFE/web`
2. `npm ci`
3. `npm run build`
4. Deploy `dist/` to GitHub Pages

## Recommended runtime env

```env
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
