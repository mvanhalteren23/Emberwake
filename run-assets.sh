#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-all}"

find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi
  local unity_node="/Applications/Unity/Hub/Editor/6000.6.8f1/PlaybackEngines/WebGLSupport/BuildTools/Emscripten/node/node"
  if [ -x "$unity_node" ]; then
    echo "$unity_node"
    return
  fi
  echo "Error: Node.js not found. Install Node >= 22.15 or check Unity's Node path." >&2
  exit 1
}

stop_existing_daemons() {
  if pgrep -f "scripts/gemini_asset_daemon.py" >/dev/null 2>&1; then
    pkill -f "scripts/gemini_asset_daemon.py" >/dev/null 2>&1 || true
    sleep 1
  fi
}

sanitize_api_key() {
  printf '%s' "$1" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^export[[:space:]]+//; s/^GEMINI_API_KEY=//; s/^[[:space:]]+//; s/^["'"'"']//; s/["'"'"']$//'
}

save_api_key() {
  local clean_key="$1"
  if [ -f ".env" ]; then
    grep -v '^GEMINI_API_KEY=' ".env" > ".env.tmp" || true
    mv ".env.tmp" ".env"
  fi
  printf 'GEMINI_API_KEY="%s"\n' "$clean_key" >> ".env"
  chmod 600 ".env"
  export GEMINI_API_KEY="$clean_key"
}

prompt_and_save_key() {
  local prompt_msg="$1"
  printf "%s" "$prompt_msg"
  read -r -s RAW_KEY
  echo ""
  local clean_key
  clean_key="$(sanitize_api_key "$RAW_KEY")"
  if [ -z "$clean_key" ] || [ "$clean_key" = "your-gemini-api-key" ]; then
    echo "No valid GEMINI_API_KEY provided. Aborting." >&2
    exit 1
  fi
  save_api_key "$clean_key"
}

ensure_api_key() {
  if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
  fi

  if [ -z "${GEMINI_API_KEY:-}" ] || [ "${GEMINI_API_KEY:-}" = "your-gemini-api-key" ]; then
    prompt_and_save_key "Paste your Gemini API key from Google AI Studio (saved locally to .env, gitignored): "
  fi

  while ! .venv/bin/python scripts/gemini_asset_daemon.py --check-key; do
    echo "The current GEMINI_API_KEY was rejected by the Gemini API." >&2
    prompt_and_save_key "Paste a valid Gemini API key (raw key starting with AIza...): "
  done
}

emit_manifest() {
  local node_bin
  node_bin="$(find_node)"
  "$node_bin" --experimental-strip-types tools/asset-pipeline/emit.ts "$@"
}

case "$MODE" in
  test)
    stop_existing_daemons
    ensure_api_key
    emit_manifest --only qte.prompt.tap --reset
    .venv/bin/python scripts/gemini_asset_daemon.py --once
    emit_manifest --sync --only qte.prompt.tap
    ;;
  all)
    stop_existing_daemons
    ensure_api_key
    emit_manifest
    .venv/bin/python scripts/gemini_asset_daemon.py --once
    emit_manifest --sync
    ;;
  watch)
    stop_existing_daemons
    ensure_api_key
    emit_manifest
    exec .venv/bin/python scripts/gemini_asset_daemon.py
    ;;
  reset-key)
    if [ -f ".env" ]; then
      grep -v '^GEMINI_API_KEY=' ".env" > ".env.tmp" || true
      mv ".env.tmp" ".env"
    fi
    unset GEMINI_API_KEY || true
    prompt_and_save_key "Paste your Gemini API key from Google AI Studio (saved locally to .env, gitignored): "
    if .venv/bin/python scripts/gemini_asset_daemon.py --check-key; then
      echo "GEMINI_API_KEY verified and saved to .env."
    else
      echo "Warning: that key was rejected by the Gemini API." >&2
      exit 1
    fi
    ;;
  emit-test)
    emit_manifest --only qte.prompt.tap --reset
    ;;
  emit)
    emit_manifest
    ;;
  dry-run)
    emit_manifest --dry-run
    ;;
  help|-h|--help)
    cat <<'EOF'
Usage: ./run-assets.sh [mode]
  (no args)   Verify/save GEMINI_API_KEY in .env, generate all 31 assets, and sync manifest
  test        Verify/save GEMINI_API_KEY in .env and generate 1 test asset (qte.prompt.tap)
  watch       Verify/save GEMINI_API_KEY and keep daemon running for future manifest updates
  reset-key   Replace and verify GEMINI_API_KEY in .env
  emit        Only regenerate shared_pipeline/manifests/pending_assets.json
  emit-test   Only emit qte.prompt.tap
  dry-run     Preview manifest counts without writing files
EOF
    ;;
  *)
    echo "Unknown mode: $MODE (try ./run-assets.sh help)" >&2
    exit 1
    ;;
esac
