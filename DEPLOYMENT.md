# Deployment Guide — Uniform Inventories (Bluhost / Docker)

Same workflow as **Supply List**: you commit and push to `main` on GitHub; GitHub Actions SSHes to the server, updates the code, builds, and restarts the app.

## Production architecture (vp691.bluhost.pl)

| Item | Value |
| --- | --- |
| **Public URL** | https://inventories.scubaspa.com (HTTP basic auth via HAProxy) |
| **SSH** | `supply@vp691.bluhost.pl` (same user as Supply; use your existing deploy key) |
| **App process** | Docker container `inventories` → host port **3000** |
| **Git clone (build)** | `/home/invento/inventories/repo` |
| **Live directory (Docker volume)** | `/home/invento/inventories/app` |
| **Docker config** | `/root/docker/local/inventories/` (`start.sh`, `.env`) |
| **SQLite (live data)** | `uniform_inventory.db` in the deploy directory (mounted as `/opt/app/uniform_inventory.db`) |
| **GitHub repo** | https://github.com/todemes/inventories |

The Node app serves API + static files from `uniform-inventory/`. Runtime env (`PORT`, `DB_PATH`) is set by Docker (`/root/docker/local/inventories/.env`), not only by the repo `.env` file.

## Day-to-day deploy (developers)

```bash
git add -A
git status   # ensure .env and *.db are not staged
git commit -m "Describe your change"
git push origin main
```

Then open **GitHub → Actions** and confirm **Deploy to Production Server** is green (about 1–2 minutes).

Manual run without a new commit: **Actions → Deploy to Production Server → Run workflow**.

## GitHub Actions secrets

Configure on **this** repository (`todemes/inventories`), not only on Supply:

https://github.com/todemes/inventories/settings/secrets/actions

| Secret | Value |
| --- | --- |
| `SERVER_HOST` | `vp691.bluhost.pl` |
| `SERVER_USER` | `supply` |
| `SERVER_SSH_KEY` | Full **private** SSH key (same as Supply if deploy works there) |

Optional:

| Secret | Value |
| --- | --- |
| `APP_PATH` | Git clone path if not `/home/invento/inventories/repo` |
| `LIVE_PATH` | Docker mount path if not `/home/invento/inventories/app` |

Secrets are **per repository**. Reuse the same host, user, and key as Supply; only the deploy path and restart command differ.

## One-time server setup

Run once from your Mac (key `~/.ssh/supply_server_key`):

```bash
SSH="ssh -i ~/.ssh/supply_server_key supply@vp691.bluhost.pl"
REPO_PATH="/home/invento/inventories/repo"
APP_LEGACY="/home/invento/inventories/app"

# 1. Backups
$SSH 'sudo cp "$APP_LEGACY/.env" /home/invento/inventories/app.env.backup 2>/dev/null || true
$SSH 'sudo cp "$APP_LEGACY/uniform_inventory.db" /home/invento/inventories/uniform_inventory.db.backup'

# 2. Git clone (user invento)
$SSH "sudo -u invento git clone https://github.com/todemes/inventories.git $REPO_PATH"

# 3. Copy live data (not in GitHub)
$SSH "sudo cp /home/invento/inventories/uniform_inventory.db.backup $REPO_PATH/uniform_inventory.db"
$SSH "sudo cp /home/invento/inventories/app.env.backup $REPO_PATH/.env 2>/dev/null || true"
$SSH "sudo chown invento:invento $REPO_PATH/uniform_inventory.db $REPO_PATH/.env 2>/dev/null || true"

# 4. First build on server
$SSH "sudo -u invento bash -lc 'cd $REPO_PATH && npm install && npm run build'"

# 5. Verify Docker still mounts app/ (do not switch to repo/ — DB lives in app/)
$SSH 'sudo grep inventories/app /root/docker/local/inventories/start.sh'

# 6. Verify site loads (container should already be running)
$SSH 'sudo docker ps --filter name=inventories'
```

Keep Docker volume on **`app/`**. Each deploy syncs `dist/` and `uniform-inventory/` from `repo/` into `app/`.

## What the workflow does on each push

1. SSH as `supply`
2. `git fetch` + `git reset --hard origin/main` in `repo/` as `invento`
3. `npm install` + `npm run build` in `repo/`
4. `rsync` `dist/` and `uniform-inventory/` into `app/` (live Docker mount)
5. `docker restart inventories`

It does **not** delete or replace `uniform_inventory.db` in `app/`.

## Database and backups

- **Do not commit** `uniform_inventory.db` or production `.env` to GitHub.
- Live file on server: `/home/invento/inventories/repo/uniform_inventory.db`

Example nightly backup (on server):

```cron
0 3 * * * sqlite3 /home/invento/inventories/repo/uniform_inventory.db ".backup /home/invento/inventories/backups/uniform_inventory_$(date +\%Y\%m\%d).db"
```

## Rollback

```bash
ssh -i ~/.ssh/supply_server_key supply@vp691.bluhost.pl
sudo -u invento bash -lc 'cd /home/invento/inventories/repo && git fetch origin && git log --oneline -n 10'
# pick a good commit:
sudo -u invento bash -lc 'cd /home/invento/inventories/repo && git reset --hard <sha> && npm install && npm run build'
sudo docker restart inventories
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ssh: no key found` | Bad `SERVER_SSH_KEY` secret | Paste full private key PEM on **inventories** repo |
| `Deploy path is not a git clone` | One-time setup not done | Run [One-time server setup](#one-time-server-setup) |
| `git fetch` fails | No network or private repo auth | Test: `sudo -u invento git ls-remote https://github.com/todemes/inventories.git` |
| Health check warning | Container still starting or crash | `sudo docker logs inventories --tail 80` |
| Site OK but old UI | Browser cache | Hard refresh; check commit on server: `git -C repo log -1` |
| 502 / HAProxy | Container down | `sudo docker ps`, restart container |

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Default local URL: http://localhost:3000
