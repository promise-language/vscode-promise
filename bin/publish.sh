#!/bin/bash
set -euo pipefail

# bin/publish.sh — cut a Promise extension release.
#
# Bumps the version in package.json AND package-lock.json (via `npm version`),
# commits, creates a `vX.Y.Z` tag, and pushes. Pushing the tag triggers
# .github/workflows/publish.yml, which runs the tests, packages the extension,
# and publishes to the VS Code Marketplace and Open VSX.
#
# This script never publishes directly — the marketplace tokens live in the
# repo's GitHub Actions secrets (VSCE_PAT / OVSX_PAT), not on your machine.
#
# Usage:
#   bin/publish.sh            # prompts for the new version
#   bin/publish.sh 0.2.1      # non-interactive version
#   bin/publish.sh patch      # also accepts npm bump keywords (patch/minor/major)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

die() { echo "error: $*" >&2; exit 1; }

# --- preflight: clean checkout on main, in sync with origin --------------------

branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || die "must be on 'main' (currently on '$branch')"

[ -z "$(git status --porcelain)" ] || die "working tree is dirty — commit or stash first"

echo "Fetching origin..."
git fetch --quiet origin main
[ "$(git rev-parse @)" = "$(git rev-parse origin/main)" ] || \
    die "local 'main' is out of sync with 'origin/main' — pull/push first"

# --- resolve the new version ---------------------------------------------------

current="$(node -p "require('./package.json').version")"
echo "Current version: $current"

arg="${1:-}"
if [ -z "$arg" ]; then
    read -rp "New version (X.Y.Z, or patch/minor/major): " arg
fi
[ -n "$arg" ] || die "no version given"

# Accept an explicit X.Y.Z (with optional leading 'v') or an npm bump keyword.
case "$arg" in
    patch|minor|major) bump="$arg" ;;
    *)
        bump="${arg#v}"
        echo "$bump" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$' || \
            die "invalid version '$arg' (expected X.Y.Z or patch/minor/major)"
        ;;
esac

# --- preflight: build + test exactly as CI will --------------------------------

echo "==> npm ci"
npm ci
echo "==> npm run compile"
npm run compile
echo "==> npm test"
npm test
echo "==> vsce package (dry run)"
npx vsce package --out /tmp/promise-publish-check.vsix >/dev/null
rm -f /tmp/promise-publish-check.vsix

# --- confirm, bump, tag, push --------------------------------------------------

# Compute the resulting version string for the confirmation prompt.
if echo "$bump" | grep -Eq '^[0-9]'; then
    next="$bump"
else
    next="$(node -e "const s=require('semver');console.log(s.inc('$current','$bump'))" 2>/dev/null || true)"
fi

echo
echo "About to release ${next:+v$next }from $current and push the tag,"
echo "which will publish to the VS Code Marketplace and Open VSX."
read -rp "Proceed? [y/N] " ok
case "$ok" in y|Y|yes|YES) ;; *) die "aborted" ;; esac

# `npm version` updates package.json + package-lock.json, commits, and tags vX.Y.Z.
echo "==> npm version $bump"
new_tag="$(npm version "$bump" -m "Release v%s")"
echo "Created $new_tag"

echo "==> git push origin main --follow-tags"
git push origin main --follow-tags

echo
echo "Pushed $new_tag. The Publish workflow is now running."
if command -v gh >/dev/null 2>&1; then
    echo "Watching the run (Ctrl-C to stop watching; the run continues):"
    sleep 5
    run_id="$(gh run list --workflow Publish --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)"
    [ -n "$run_id" ] && gh run watch "$run_id" --exit-status || true
else
    echo "Install the GitHub CLI (gh) to watch the run, or check the Actions tab."
fi
