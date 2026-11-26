#!/usr/bin/env bash
# Fails the build if the files served to browsers contain secret-looking names, a Resend key, or source maps.
# Runs in CI and in the Netlify build (Netlify deploys even when CI is red).
set -euo pipefail
dir="${1:-dist}"
if grep -rIlE 'ADMIN_|RESEND|\bre_[A-Za-z0-9]{20,}' "$dir"; then
  echo "scan-dist: $dir contains a secret-looking name or key"; exit 1
fi
if find "$dir" -name '*.map' | grep -q .; then
  echo "scan-dist: $dir contains a source map"; exit 1
fi
echo "scan-dist: ok"
