# XorvilaBox - Production Deployment Guide for Ubuntu VPS

XorvilaBox is a production-ready anime storage and video file hosting platform built with React, Node.js/Express, SQLite, and native VPS filesystem streaming with HTTP Range requests.

---

## 1. Install Node.js (v20+ LTS)

On your clean Ubuntu VPS (Ubuntu 22.04 LTS or 24.04 LTS):

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx

# Install Node.js 20.x LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v   # Should be v20.x or higher
npm -v
```

---

## 2. Create Dedicated System User & Directory

Never run your storage application as `root`. Create a dedicated system user:

```bash
sudo useradd -r -s /bin/bash -d /var/www/xorvilabox xorvila
sudo mkdir -p /var/www/xorvilabox
sudo chown -R xorvila:xorvila /var/www/xorvilabox
```

---

## 3. Create Real Storage Directory

Set up the physical filesystem directory where all anime videos and imported archives will reside:

```bash
sudo mkdir -p /var/lib/xorvilabox/storage
sudo mkdir -p /var/www/xorvilabox/data

# Give write permissions to the xorvila service user
sudo chown -R xorvila:xorvila /var/lib/xorvilabox/storage
sudo chown -R xorvila:xorvila /var/www/xorvilabox/data
sudo chmod -R 750 /var/lib/xorvilabox/storage
```

---

## 4. Clone Project & Install Dependencies

Switch to the `xorvila` user or deploy the codebase into `/var/www/xorvilabox`:

```bash
cd /var/www/xorvilabox
# (Copy files or clone repository here)

# Install production dependencies
npm install
```

---

## 5. Configure `.env` File

Copy the environment template and customize your secrets:

```bash
cp .env.example .env
nano .env
```

Set the production variables:

```ini
PORT=3000
STORAGE_PATH=/var/lib/xorvilabox/storage
DATABASE_URL=file:/var/www/xorvilabox/data/xorvilabox.db
PUBLIC_BASE_URL=https://your-domain.com
SESSION_SECRET=YOUR_VERY_LONG_RANDOM_SECRET_KEY_HERE_987654321
ADMIN_DEFAULT_PASSWORD=YourStrongMasterPassword!
MAX_UPLOAD_SIZE=26843545600
MAX_IMPORT_SIZE=26843545600
MAX_ZIP_SIZE=26843545600
```

Lock down file permissions so only `xorvila` can read secrets:

```bash
chmod 600 /var/www/xorvilabox/.env
```

---

## 6. Build the Application

Build the frontend static assets with Vite and bundle the backend with esbuild:

```bash
npm run build
```

This compiles:
- `dist/index.html` and optimized assets
- `dist/server.cjs` (bundled production Express backend)

---

## 7. Test Backend Execution

Run the compiled backend manually once to verify database table initialization:

```bash
node dist/server.cjs
```

You should see:
```
[XorvilaBox DB] SQLite database tables initialized.
[XorvilaBox Auth] Default administrator initialized: admin / YourStrongMasterPassword!
[XorvilaBox] Production server running on http://0.0.0.0:3000
```
Press `Ctrl+C` to stop the manual process.

---

## 8. Configure Systemd Service

Copy the systemd unit file:

```bash
sudo cp /var/www/xorvilabox/systemd/xorvilabox.service /etc/systemd/system/xorvilabox.service
sudo systemctl daemon-reload
sudo systemctl enable xorvilabox
sudo systemctl start xorvilabox
```

Check the status:

```bash
sudo systemctl status xorvilabox
# View live logs:
sudo journalctl -u xorvilabox -f
```

---

## 9. Configure Nginx Reverse Proxy

Copy the provided Nginx configuration:

```bash
sudo cp /var/www/xorvilabox/nginx/xorvilabox.conf /etc/nginx/sites-available/xorvilabox.conf
sudo ln -s /etc/nginx/sites-available/xorvilabox.conf /etc/nginx/sites-enabled/
```

Edit the domain name:

```bash
sudo nano /etc/nginx/sites-available/xorvilabox.conf
# Replace your-domain.com with your actual domain or VPS IP
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 10. Configure Free SSL / HTTPS with Certbot

Run Certbot to generate and configure Let's Encrypt SSL certificates automatically:

```bash
sudo certbot --nginx -d your-domain.com
```

Certbot will automatically renew your certificates via its internal timer.

---

## 11. Testing Video Streaming & Range Requests

Verify that HTTP Range requests are working for video seeking:

```bash
curl -I -H "Range: bytes=0-1024" https://your-domain.com/r/<file_uid>/<filename>?raw=1
```

You should see:
```http
HTTP/2 206 Partial Content
accept-ranges: bytes
content-range: bytes 0-1024/1548293021
content-length: 1025
```

---

## 12. Backup Database

To backup the SQLite metadata database:

```bash
# SQLite safe online backup command:
sqlite3 /var/www/xorvilabox/data/xorvilabox.db ".backup /var/backups/xorvilabox_$(date +%F).db"
```

You can add this to a daily cronjob (`crontab -e`).

---

## 13. Backup Storage Files

To backup or synchronize your physical anime video files to an external storage or secondary server:

```bash
rsync -avzh --progress /var/lib/xorvilabox/storage/ /mnt/backup_drive/storage/
```

---

## 14. Managing Service & Updates

When updating XorvilaBox in the future:

```bash
cd /var/www/xorvilabox
git pull
npm install
npm run build
sudo systemctl restart xorvilabox
```

Your anime storage platform is now live and running in production!
