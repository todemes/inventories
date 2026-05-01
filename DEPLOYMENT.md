# Deployment Guide - Uniform Inventory App

This project can be deployed with the same general pattern as Supply-List: GitHub stores the code, the production server keeps the live `.env` and SQLite database, and GitHub Actions SSHes into the server after each push to `main`.

## Architecture

- Nginx handles HTTPS and proxies requests to Node.js.
- One Node.js/Express process serves both the API and the static frontend from `uniform-inventory/`.
- PM2 keeps the Node process running.
- SQLite data lives on the production server at `./database/uniform_inventory.db` and is not committed to GitHub.

Recommended internal app port: `3003`.

## Server Requirements

- 1-2 CPU cores, 2 GB RAM, 10 GB disk
- Node.js v20 LTS or v22 LTS
- npm, Git, Nginx, PM2, SQLite3
- Inbound ports 80/443 and 22
- Outbound access to `github.com` and `registry.npmjs.org`

Ubuntu/Debian packages:

```bash
sudo apt update
sudo apt install -y nginx git sqlite3
sudo npm install -g pm2
```

## One-Time Server Setup

### 1. Clone the repository

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/todemes/inventories.git inventories
sudo chown -R $USER:$USER inventories
cd inventories
```

### 2. Install and build

```bash
npm install
npm run build
```

### 3. Create the production `.env` file

Create this file on the server only:

```bash
nano /var/www/inventories/.env
```

Example:

```env
NODE_ENV=production
PORT=3003
DB_PATH=./database/uniform_inventory.db
CORS_ORIGIN=https://inventory.yourcompany.com
```

Replace `inventory.yourcompany.com` with the real production domain.

### 4. Create the database directory

```bash
cd /var/www/inventories
mkdir -p database
chmod 700 database
```

The app creates and migrates tables automatically on startup.

### 5. Start with PM2

```bash
cd /var/www/inventories
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Useful commands:

```bash
pm2 status
pm2 logs uniform-inventory
pm2 restart uniform-inventory
```

### 6. Configure Nginx

Create `/etc/nginx/sites-available/uniform-inventory`:

```nginx
server {
    listen 443 ssl;
    server_name inventory.yourcompany.com;

    ssl_certificate     /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name inventory.yourcompany.com;
    return 301 https://$host$request_uri;
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/uniform-inventory /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

For Let's Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d inventory.yourcompany.com
```

## Automatic Deployment from GitHub

The repository includes `.github/workflows/deploy.yml`. On every push to `main`, GitHub Actions SSHes into the production server, pulls the latest code, runs `npm install`, runs `npm run build`, ensures `database/` exists, and restarts PM2.

### IT one-time setup

1. Create an SSH key for GitHub Actions to access the server:

```bash
ssh-keygen -t ed25519 -C "github-deploy-inventories" -f ~/.ssh/github_deploy_inventories -N ""
cat ~/.ssh/github_deploy_inventories.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

2. If the repository is private, create a read-only deploy key for server-side `git pull`:

```bash
ssh-keygen -t ed25519 -C "server-repo-pull-inventories" -f ~/.ssh/github_repo_pull_inventories -N ""
cat ~/.ssh/github_repo_pull_inventories.pub
```

Add that public key in GitHub: repository Settings -> Deploy keys -> Add deploy key. Do not enable write access.

Configure the server to use it:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_repo_pull_inventories
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

cd /var/www/inventories
git remote set-url origin git@github.com:todemes/inventories.git
git ls-remote origin
```

3. Add GitHub Actions secrets in `todemes/inventories`:

| Secret | Value |
| --- | --- |
| `SERVER_HOST` | Server IP or hostname |
| `SERVER_USER` | SSH deployment username |
| `SERVER_SSH_KEY` | Private key contents from `~/.ssh/github_deploy_inventories` |

Optional:

| Secret | Value |
| --- | --- |
| `APP_PATH` | App path if not `/var/www/inventories` |

## Database and Backups

Production database path:

```text
/var/www/inventories/database/uniform_inventory.db
```

This is live app data, not source code. It changes whenever users update inventory, staff, assignments, returns, locations, or history. Do not push it to GitHub.

Recommended backup:

```cron
0 3 * * * sqlite3 /var/www/inventories/database/uniform_inventory.db ".backup /backups/inventories/uniform_inventory_$(date +\%Y\%m\%d).db"
```

## Verification

After deployment:

```bash
pm2 status
pm2 logs uniform-inventory --lines 50
curl -f https://inventory.yourcompany.com/api/health
```

Also open `https://inventory.yourcompany.com` in a browser and confirm stock and staff pages load.

## Rollback

```bash
cd /var/www/inventories
git fetch origin
git log --oneline -n 10
git checkout <known_good_commit_sha>
npm install --production=false
npm run build
pm2 restart uniform-inventory
```

Return to normal:

```bash
git checkout main
git pull origin main
npm install --production=false
npm run build
pm2 restart uniform-inventory
```

## Troubleshooting

| Problem | Check |
| --- | --- |
| App not loading | `pm2 status`, `pm2 logs uniform-inventory` |
| 502 Bad Gateway | Confirm Nginx proxies to `127.0.0.1:3003` and PM2 is running |
| API failing | Check `/api/health` and PM2 logs |
| Database errors | Check `DB_PATH`, directory permissions, and disk space |
| GitHub Action fails at SSH | Check `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` |
| GitHub Action fails at git pull | Check server deploy key and `git ls-remote origin` |