# Fretboard Freedom AI server — infrastructure as code

Provisions an Oracle Cloud Ampere A1 (ARM) instance as the always-on backend
for the Fretboard Freedom web app's server mode:

- **Ollama** — lyric-line candidates from `qwen2.5:0.5b` (fast on 4 ARM cores)
- **fretboard-ai** — a small FastAPI service (`server/app.py`) on
  `127.0.0.1:8000` that serves `/api/lyrics` (Ollama proxy) and
  `/api/musicgen` (MusicGen-small backing tracks via ONNX Runtime)
- **Cloudflare Tunnel** (`cloudflared`) — the only way in from the internet.
  The app is served over HTTPS from GitHub Pages, so the API must be HTTPS too.
  Nothing listens on a public port; the OCI security list needs no ingress rules.

## Layout

```
infra/
  README.md                  this file
  setup.sh                   one-shot provisioning script (idempotent, safe to re-run)
  cloud-init.yaml            #cloud-config user_data for a fresh instance launch
  server/
    app.py                   FastAPI service (lyrics + MusicGen + health)
    requirements.txt         Python deps for the service
    __init__.py
  systemd/
    fretboard-ai.service     systemd unit for the FastAPI service
  cloudflared/
    config.yml.example       tunnel config template (never commit real credentials)
```

## Redeploy on a fresh instance

Prerequisites: an Oracle Cloud tenancy with Always Free A1 capacity, and an SSH
key pair. Launch from the **Ubuntu 22.04** platform image (Canonical), shape
`VM.Standard.A1.Flex` (4 OCPU / 24 GB on the grandfathered free tier; 2 OCPU /
12 GB also works). The PyTorch Ampere marketplace image is NOT required —
everything the server needs installs on top of plain Ubuntu.

**Option A — cloud-init (hands-free).** Paste `cloud-init.yaml` as the
instance's user_data at launch. On first boot it clones this repo and runs
`setup.sh`. Watch progress in `/var/log/cloud-init-output.log`.

**Option B — manual.** Launch the instance, SSH in as `ubuntu`, then:

```bash
git clone https://github.com/ianchen06/fretboard-freedom.git
cd fretboard-freedom
sudo bash infra/setup.sh
```

`setup.sh` is idempotent — re-running it only fills in what's missing.

## What setup.sh does

1. `apt update && apt upgrade` (non-interactive; reboots are left to you)
2. Installs base tools: curl, git, python3, pip, venv
3. Installs Ollama (official script), enables its systemd service, pulls
   `qwen2.5:0.5b` (~400 MB)
4. Creates `/opt/fretboard-ai`, a Python venv, installs `server/requirements.txt`
5. Downloads the MusicGen-small ONNX weights (Xenova/musicgen-small, q8 set,
   ~630 MB) to `/opt/fretboard-ai/models/musicgen-small`
6. Installs and starts the `fretboard-ai` systemd service (port 8000, localhost)
7. Installs `cloudflared` (binary only — the tunnel itself is a manual step)
8. Prints a health summary (`/health`, Ollama tags)

## Cloudflare Tunnel (manual, once)

The tunnel needs a Cloudflare account and a hostname whose DNS Cloudflare
manages. One time, on the instance:

```bash
cloudflared tunnel login
cloudflared tunnel create fretboard-ai
cloudflared tunnel route dns fretboard-ai ai.<your-domain>
cp infra/cloudflared/config.yml.example ~/.cloudflared/config.yml
# edit config.yml: tunnel id + hostname
sudo cloudflared --config ~/.cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
```

Never commit the tunnel credentials (`~/.cloudflared/*.json`) — they stay on
the instance only.

## API

Base URL is the tunnel hostname, e.g. `https://ai.<your-domain>`.

- `GET /health` → `{"status": "ok", "ollama": true, "musicgen_ready": true}`
- `POST /api/lyrics` `{"prompt": "...", "count": 3}` →
  `{"candidates": ["...", "...", "..."]}` (one line each; the web app ranks
  them by tone fit, rhyme group and syllable count, as it does in-browser)
- `POST /api/musicgen` `{"prompt": "...", "duration": 10}` → `audio/wav`
  (24 kHz mono; duration 5–30 s)

The web app's server mode (in `web/js/llm.js` and `web/js/musicgen.js`) points
at this base URL and falls back to in-browser inference when it is unreachable.

## Smoke test (on the instance)

```bash
curl -s localhost:8000/health
curl -s -X POST localhost:8000/api/lyrics -H 'Content-Type: application/json' \
  -d '{"prompt": "Write one Mandarin lyric line about rain on a Taipei street:", "count": 1}'
curl -s -X POST localhost:8000/api/musicgen -H 'Content-Type: application/json' \
  -d '{"prompt": "gentle acoustic guitar, 90 bpm", "duration": 10}' -o /tmp/test.wav
file /tmp/test.wav   # expect: RIFF (little-endian) data, WAVE audio
```

## Notes

- **MusicGen backend.** `app.py` generates with ONNX Runtime by default
  (`MUSICGEN_BACKEND=onnx`), using the staged Xenova weights. If the ONNX
  path misbehaves, flip it to the transformers/PyTorch backend
  (`MUSICGEN_BACKEND=transformers`, `facebook/musicgen-small`) in the systemd
  unit — same API, slower (tens of seconds per 10 s clip on CPU), no code change.
  The transformers backend needs a working `torch` install; the PyTorch
  Ampere marketplace image ships one, plain Ubuntu does not.
- **Costs.** The A1 shape above is inside the Always Free tier, so the server
  is $0/month. The boot volume is 100 GB of the 200 GB free allowance.
- **Don't terminate the instance.** A1 capacity is scarce and a terminated
  Always Free instance may not be recreatable at the grandfathered 4 OCPU /
  24 GB size. Redeploy means a *new* instance from this code, not deleting the
  old one first.
- **Model sizes.** Ollama qwen2.5:0.5b ~400 MB; MusicGen ONNX q8 set ~630 MB.
- **Model location.** The canonical path is
  `/opt/fretboard-ai/models/musicgen-small` (`MODEL_DIR`). On the original
  instance the weights were first staged under `~/models/musicgen-small`;
  the service reads `MODEL_DIR`, so either path works.
