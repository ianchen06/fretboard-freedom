#!/usr/bin/env bash
# Fretboard Freedom AI server — one-shot provisioning for an Oracle A1 (ARM) instance.
#
# Installs: system updates, Ollama (+ qwen2.5:0.5b), the fretboard-ai FastAPI
# service (ONNX Runtime MusicGen + lyrics proxy), the MusicGen ONNX weights,
# and the cloudflared binary (the tunnel itself is a manual step, see README).
#
# Usage: sudo bash infra/setup.sh
# Idempotent: safe to re-run; steps that are already done are skipped.
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="${SUDO_USER:-ubuntu}"
INSTALL_ROOT="/opt/fretboard-ai"
MODEL_DIR="$INSTALL_ROOT/models/musicgen-small"
OLLAMA_MODEL="qwen2.5:1.5b"

log() { echo "==> $*"; }
warn() { echo "!! $*" >&2; }

# Must run as root (directly, or via sudo which sets SUDO_USER).
if [ "$(id -u)" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

log "Provisioning Fretboard Freedom AI server as $APP_USER (infra: $INFRA_DIR)"

# 1. System upgrade (non-interactive; no automatic reboot).
log "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git python3 python3-pip python3-venv jq

# 2. Ollama: install, enable, pull the lyric model.
if ! command -v ollama >/dev/null 2>&1; then
  log "Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  log "Ollama already installed ($(ollama --version | head -1))"
fi
systemctl enable --now ollama
log "Waiting for Ollama on 127.0.0.1:11434..."
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS http://127.0.0.1:11434/api/tags >/dev/null || {
  warn "Ollama did not answer on 127.0.0.1:11434; check 'systemctl status ollama'"
  exit 1
}
if ollama list 2>/dev/null | grep -q "$OLLAMA_MODEL"; then
  log "Ollama model $OLLAMA_MODEL already present"
else
  log "Pulling Ollama model $OLLAMA_MODEL (~1 GB)..."
  ollama pull "$OLLAMA_MODEL"
fi

# 3. App directory, venv, Python deps.
log "Setting up $INSTALL_ROOT..."
mkdir -p "$INSTALL_ROOT/server" "$INSTALL_ROOT/models"
cp "$INFRA_DIR/server/app.py" "$INFRA_DIR/server/requirements.txt" "$INFRA_DIR/server/__init__.py" "$INSTALL_ROOT/server/"
chown -R "$APP_USER:$APP_USER" "$INSTALL_ROOT"
if [ ! -x "$INSTALL_ROOT/venv/bin/python" ]; then
  sudo -u "$APP_USER" python3 -m venv "$INSTALL_ROOT/venv"
fi
sudo -u "$APP_USER" "$INSTALL_ROOT/venv/bin/pip" install -q -U pip
sudo -u "$APP_USER" "$INSTALL_ROOT/venv/bin/pip" install -q -r "$INSTALL_ROOT/server/requirements.txt"

# 4. MusicGen ONNX weights (Xenova/musicgen-small, q8 set, ~630 MB).
if find "$MODEL_DIR" -name '*.onnx' -print -quit 2>/dev/null | grep -q .; then
  log "MusicGen ONNX weights already present in $MODEL_DIR"
else
  log "Downloading MusicGen-small ONNX weights to $MODEL_DIR..."
  sudo -u "$APP_USER" "$INSTALL_ROOT/venv/bin/python" - "$MODEL_DIR" <<'PYEOF'
import sys
from huggingface_hub import snapshot_download
snapshot_download("Xenova/musicgen-small", local_dir=sys.argv[1])
PYEOF
  log "Weights downloaded: $(du -sh "$MODEL_DIR" | cut -f1)"
fi

# 5. systemd service for the FastAPI app.
log "Installing fretboard-ai systemd service..."
sed "s/^User=.*/User=$APP_USER/" "$INFRA_DIR/systemd/fretboard-ai.service" \
  > /etc/systemd/system/fretboard-ai.service
systemctl daemon-reload
systemctl enable --now fretboard-ai
sleep 3
log "Waiting for the API on 127.0.0.1:8000..."
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && break
  sleep 2
done

# 6. cloudflared binary only (tunnel setup is manual, see README).
if ! command -v cloudflared >/dev/null 2>&1; then
  log "Installing cloudflared..."
  cd /tmp
  curl -fsSL -o cloudflared-linux-arm64.deb \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  dpkg -i cloudflared-linux-arm64.deb || apt-get install -f -y
  rm -f cloudflared-linux-arm64.deb
else
  log "cloudflared already installed ($(cloudflared --version | head -1))"
fi

# 7. Summary.
echo
log "Done. Health summary:"
curl -fsS http://127.0.0.1:8000/health || warn "API /health did not answer; check 'systemctl status fretboard-ai'"
echo
log "Ollama models:"; ollama list
echo
log "Next steps (see infra/README.md): create the Cloudflare Tunnel, then point the"
log "web app's server mode at the tunnel hostname. Smoke test with:"
log "  curl -s localhost:8000/health"
log "  curl -s -X POST localhost:8000/api/musicgen -H 'Content-Type: application/json' \\"
log "    -d '{\"prompt\": \"gentle acoustic guitar, 90 bpm\", \"duration\": 10}' -o /tmp/test.wav"
if [ -f /var/run/reboot-required ]; then
  warn "A reboot is required for the kernel update (sudo reboot when convenient)."
fi
