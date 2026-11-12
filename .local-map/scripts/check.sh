#!/usr/bin/env bash
# Run every project check and keep the output as evidence.
#
# Usage:  .local-map/scripts/check.sh          typecheck, lint, unit tests
#         .local-map/scripts/check.sh --all    the same, then the production build and the browser tests
#
# Writes .local-map/evidence/checks/latest.txt (overwritten each run) so that "the checks pass"
# is something a reader can open, with the commit it was run against and the time.
# --all needs to open a local port (the build and the test server do), so it cannot run in a
# sandbox that forbids that.
set -u
cd "$(dirname "$0")/../.."

out=".local-map/evidence/checks/latest.txt"
mkdir -p "$(dirname "$out")"
steps="typecheck lint test"
if [ "${1:-}" = "--all" ]; then steps="$steps e2e"; fi

{
  echo "date:   $(date '+%Y-%m-%d %H:%M %Z')"
  # The evidence file is being rewritten right now, so it does not count as a change.
  echo "commit: $(git rev-parse --short HEAD 2>/dev/null) $(git status --porcelain -- . ':!.local-map/evidence' | grep -q . && echo '(with uncommitted changes)')"
  echo "node:   $(node -v)   pnpm: $(pnpm -v)"
  for step in $steps; do
    echo
    echo "===== pnpm $step ====="
    # e2e builds the app first (see playwright.config.ts), so it also proves "pnpm build".
    if pnpm --silent "$step" 2>&1; then
      echo "----- $step: PASS"
    else
      echo "----- $step: FAIL"
    fi
  done
  # The tools print absolute paths; the evidence is committed, so keep only paths inside the project.
} | sed "s#$PWD#.#g" | tee "$out"

# The braces run in a subshell because of the pipe, so read the verdict back from the file.
status=0
if grep -q -- "----- .*: FAIL" "$out"; then status=1; fi
echo
echo "Saved to $out"
exit $status
