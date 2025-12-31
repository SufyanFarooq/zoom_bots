# 🔄 GitHub Setup Guide

## Initial Setup

### 1. Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it: `zoom-bots` (or your preferred name)
3. **Don't** initialize with README (we already have files)

### 2. Local Machine Setup (Mac)

```bash
cd /Users/mac/Downloads/zoom-bots

# Initialize git if not already done
git init

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/zoom-bots.git
# OR with SSH:
git remote add origin git@github.com:YOUR_USERNAME/zoom-bots.git

# Add all files
git add .

# Commit
git commit -m "Initial commit: Zoom bots project"

# Push to GitHub
git branch -M main
git push -u origin main
```

## Server Setup

### 1. Clone Repository on Server

```bash
# SSH into server
ssh user@server-ip

# Clone repository
cd /home/user
git clone https://github.com/YOUR_USERNAME/zoom-bots.git
# OR with SSH:
git clone git@github.com:YOUR_USERNAME/zoom-bots.git

cd zoom-bots

# Install dependencies
npm install --production
```

### 2. Setup Environment File

```bash
# Create .env file (not tracked by git)
cp .env.example .env  # If you have example file
# OR create manually
nano .env
```

Add your configuration:
```env
CHROME_PATH=/usr/bin/google-chrome
MEETING_URL=https://zoom.us/wc/join/YOUR_MEETING_ID
MEETING_PASSCODE=your_passcode
TOTAL_BOTS=200
MAX_CONCURRENT=30
DELAY_MS=2000
KEEP_ALIVE_MINUTES=30
```

## Daily Workflow

### On Local Machine (Mac)

```bash
cd /Users/mac/Downloads/zoom-bots

# Make changes to code...

# Check status
git status

# Add changes
git add .

# Commit
git commit -m "Description of changes"

# Push to GitHub
git push origin main
```

### On Server

```bash
# SSH into server
ssh user@server-ip

cd /home/user/zoom-bots

# Pull latest changes
git pull origin main

# Install new dependencies (if package.json changed)
npm install --production

# Restart application
pm2 restart zoom-bots
# OR
npm run stop
npm run launch -- 200 "https://zoom.us/wc/join/123456" "password"
```

## Automated Pull Script

Create a script to automatically pull and restart:

```bash
# On server
nano /home/user/zoom-bots/pull-and-restart.sh
```

Add:
```bash
#!/bin/bash
cd /home/user/zoom-bots
git pull origin main
npm install --production
pm2 restart zoom-bots
echo "✅ Updated and restarted!"
```

```bash
chmod +x pull-and-restart.sh
```

## Git Configuration on Server

```bash
# Set your name and email
git config --global user.name "Server User"
git config --global user.email "server@example.com"

# Or for this repository only
cd /home/user/zoom-bots
git config user.name "Server User"
git config user.email "server@example.com"
```

## SSH Key Setup (Recommended)

### Generate SSH Key on Server

```bash
# On server
ssh-keygen -t ed25519 -C "server@zoom-bots"
# Press Enter for default location
# Enter passphrase (optional)

# Copy public key
cat ~/.ssh/id_ed25519.pub
```

### Add to GitHub

1. Go to GitHub → Settings → SSH and GPG keys
2. Click "New SSH key"
3. Paste the public key
4. Save

### Update Remote URL

```bash
cd /home/user/zoom-bots
git remote set-url origin git@github.com:YOUR_USERNAME/zoom-bots.git
```

## Branch Strategy (Optional)

### Create Development Branch

```bash
# On local machine
git checkout -b development
git push -u origin development

# On server (for testing)
git checkout development
git pull origin development
```

## Useful Git Commands

```bash
# Check status
git status

# View changes
git diff

# View commit history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard local changes
git checkout -- .

# Create new branch
git checkout -b feature-name

# Switch branch
git checkout main

# Merge branch
git merge feature-name
```

## Troubleshooting

### Merge Conflicts

```bash
# If pull fails due to conflicts
git pull origin main

# Resolve conflicts in files
nano conflicted-file.js

# After resolving
git add .
git commit -m "Resolved merge conflicts"
git push origin main
```

### Server Has Local Changes

```bash
# Stash local changes
git stash

# Pull
git pull origin main

# Apply stashed changes
git stash pop
```

### Reset to Remote Version

```bash
# Discard all local changes
git fetch origin
git reset --hard origin/main
```

## Automated Deployment (Advanced)

### GitHub Webhook Setup

1. Create webhook script on server:
```bash
nano /home/user/zoom-bots/webhook.sh
```

```bash
#!/bin/bash
cd /home/user/zoom-bots
git pull origin main
npm install --production
pm2 restart zoom-bots
```

2. Setup webhook endpoint (requires web server like nginx)

## Best Practices

1. **Always commit .env to .gitignore** ✅
2. **Commit meaningful messages** ✅
3. **Pull before making changes on server** ✅
4. **Test locally before pushing** ✅
5. **Use branches for major changes** ✅
6. **Keep server and local in sync** ✅

## Quick Reference

```bash
# Local → GitHub
git add .
git commit -m "message"
git push origin main

# Server ← GitHub
git pull origin main
npm install --production
pm2 restart zoom-bots
```

