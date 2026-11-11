#!/usr/bin/env bash
# Run every project check and keep the output as evidence.
#
# Usage:  .local-map/scripts/check.sh
#
# Writes .local-map/evidence/checks/latest.txt (overwritten each run) so that "the checks pass"
# is something a reader can open, with the commit it was run against and the time.
set -u
cd "$(dirname "$0")/../.."

out=".local-map/evidence/checks/latest.txt"
mkdir -p "$(dirname "$out")"
status=0

{
  echo "date:   $(date '+%Y-%m-%d %H:%M %Z')"
  # The evidence file is being rewritten right now, so it does not count as a change.
  echo "commit: $(git rev-parse --short HEAD 2>/dev/null) $(git status --porcelain -- . ':!.local-map/evidence' | grep -q . && echo '(with uncommitted changes)')"
  echo "node:   $(node -v)   pnpm: $(pnpm -v)"
  for step in typecheck lint test; do
    echo
    echo "===== pnpm $step ====="
    if pnpm --silent "$step" 2>&1; then
      echo "----- $step: PASS"
    else
      echo "----- $step: FAIL"
      status=1
    fi
  done
} | tee "$out"

# The braces run in a subshell because of the pipe, so read the verdict back from the file.
if grep -q -- "----- .*: FAIL" "$out"; then status=1; fi
echo
echo "Saved to $out"
exit $status
