# CI workflows — install manually

This directory holds the GitHub Actions workflow in plain-file form. It lives outside `.github/workflows/` because the OAuth token used by `auto-push.sh` doesn't have `workflow` scope — GitHub refuses to create or update anything under `.github/workflows/` without it.

To activate CI:

**Option A — GitHub web UI (recommended)**

1. Open the repo on GitHub.
2. **Add file → Create new file**.
3. Name it `.github/workflows/ci.yml`.
4. Paste the contents of `ci/github-actions-ci.yml` from this repo.
5. Commit to `main`. CI starts running on the next push and on PRs.

**Option B — Rotate to a Personal Access Token with `workflow` scope**

1. Create a PAT with `repo` + `workflow` scopes.
2. `git remote set-url origin https://<token>@github.com/<user>/<repo>.git`
3. ```
   mkdir -p .github/workflows
   cp ci/github-actions-ci.yml .github/workflows/ci.yml
   git add .github/workflows/ci.yml
   git commit -m "Add CI workflow"
   git push
   ```

The file is identical to a regular workflow — the location here is purely to work around the local push restriction.

## Contents

- `github-actions-ci.yml` — lint, HTML reference integrity check, `npm audit --audit-level=high`, CodeQL static analysis. Runs on push to `main` and on PRs.
