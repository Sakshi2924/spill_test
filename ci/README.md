# GitHub Actions workflows

The workflow file ships as `ci.yml.template` because the local OAuth token used by `auto-push.sh` lacks the `workflow` scope and GitHub refuses to write to `.github/workflows/*.yml` without it.

To activate CI:

1. In the GitHub repo settings → **Secrets and variables** → nothing required; the workflow only uses read actions.
2. Rename the file **in the GitHub web UI** (or clone the repo with a token that has `workflow` scope, rename, and push):

   ```
   .github/workflows/ci.yml.template  →  .github/workflows/ci.yml
   ```

3. On the next push, the workflow will run automatically (push to main, PRs, and `workflow_dispatch`).

It is identical to a regular workflow — the `.template` suffix is purely to let the local auto-pusher upload it.
