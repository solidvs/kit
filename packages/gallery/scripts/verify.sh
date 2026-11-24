#!/usr/bin/env bash
# Rebuilds the UI package and the gallery, screenshots the given shots and compares them with the
# 0.1.x baseline. Serialized with a lock directory, so several people (or agents) can run it at once.
# Usage: bash scripts/verify.sh <tag> <shot,shot,...>
# Results: current-<tag>/ (screenshots), diff-<tag>/ (diff images, red = differing pixels).
set -euo pipefail
tag=${1:?tag}; shots=${2:?shots}
here=$(cd "$(dirname "$0")/.." && pwd)
lock=/tmp/ui-gallery-verify.lock
until mkdir "$lock" 2>/dev/null; do sleep 2; done
trap 'rmdir "$lock"' EXIT
cd "$here/../ui" && pnpm run --silent build >/dev/null
cd "$here" && pnpm run --silent build >/dev/null
curl -sf -o /dev/null http://localhost:5180/ || { echo "Gallery preview is not running on :5180 (pnpm preview)"; exit 2; }
rm -rf "current-$tag" "diff-$tag"
ONLY="$shots" node scripts/capture.ts "current-$tag" >/dev/null
node scripts/compare.ts baseline "current-$tag" "diff-$tag" | grep -E "$(echo "$shots" | sed 's/,/\\.|/g')\\." || true
