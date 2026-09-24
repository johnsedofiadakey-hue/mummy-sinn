#!/usr/bin/env bash
# Invoked by `npm run test:e2e` inside `firebase emulators:exec`, so every Firebase call goes to the emulators.
set -euo pipefail
: "${FIRESTORE_EMULATOR_HOST:?must run inside firebase emulators:exec}"
export GOOGLE_CLOUD_PROJECT="$GCLOUD_PROJECT" FIREBASE_STORAGE_BUCKET="${GCLOUD_PROJECT}.appspot.com" FIREBASE_ADMIN_PROJECT_ID="$GCLOUD_PROJECT"
PORT=3290
npx next start -p "$PORT" > "${TMPDIR:-/tmp}/mummys-inn-admin-smoke.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$PORT/admin/sign-in" && break; sleep 0.5; done
SMOKE_BASE_URL="http://localhost:$PORT" node --import tsx tests/e2e/admin-smoke.mts
