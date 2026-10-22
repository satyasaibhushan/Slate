#!/usr/bin/env bash
# Seeds a local Slate server with fictional drafts through the real CLI.
# Needs SLATE_PUBLIC_BASE_URL and SLATE_BOOTSTRAP_API_KEY from the running server.
# Usage: docs/demo/seed.sh <scratch-dir>
set -euo pipefail

demo_dir=$(cd "$(dirname "$0")" && pwd)
slate="$demo_dir/../../bin/slate.js"
work=${1:?scratch dir required}
export HOME="$work/home" # keeps ~/.slate isolated from real credentials
export GIT_AUTHOR_NAME="Demo Author" GIT_AUTHOR_EMAIL="demo@example.test"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
rm -rf "$work" && mkdir -p "$HOME"

make_repo() { # <dir> <origin> <commit subject> <files...>
  local dir=$1 origin=$2 subject=$3; shift 3
  mkdir -p "$dir"
  for file in "$@"; do cp "$demo_dir/drafts/$file" "$dir/"; done
  git -C "$dir" init -q -b main
  git -C "$dir" remote add origin "$origin"
  git -C "$dir" add . && git -C "$dir" commit -qm "$subject"
}

make_repo "$work/atlas" https://github.com/acme/atlas.git "Draft the Q4 rollout plan" rollout-plan.html incident-review.html
make_repo "$work/ledger" https://github.com/northwind/ledger.git "Write up the v2 migration" migration-notes.html

node "$slate" auth set "$SLATE_BOOTSTRAP_API_KEY" --api-url "$SLATE_PUBLIC_BASE_URL" >/dev/null
(cd "$work/atlas" && node "$slate" upload incident-review.html --description "Blameless review of the nightly rebuild" >/dev/null)
(cd "$work/ledger" && node "$slate" upload migration-notes.html --description "For the partner team" --public >/dev/null)
echo "Seeded $work"
