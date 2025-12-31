# ⚡ GitHub Quick Start

## 🚀 Initial Setup (One Time)

### Step 1: Create GitHub Repository
1. Go to https://github.com
2. Click "New repository"
3. Name: `zoom-bots`
4. **Don't** check "Initialize with README"
5. Click "Create repository"

### Step 2: Push Code from Mac

```bash
cd /Users/mac/Downloads/zoom-bots

# Initialize git (if not done)
git init

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/zoom-bots.git

# Add all files
git add .

# First commit
git commit -m "Initial commit: Zoom bots project"

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Clone on Server

```bash
# SSH into server
ssh user@server-ip

# Clone repository
cd /home/user
git clone https://github.com/YOUR_USERNAME/zoom-bots.git
cd zoom-bots

# Install dependencies
npm install --production

# Create .env file (not in git)
nano .env
# Add your meeting details
```

## 📤 Daily Workflow

### On Mac (Push Changes)

```bash
cd /Users/mac/Downloads/zoom-bots

# Make your code changes...

# Check what changed
git status

# Add changes
git add .

# Commit
git commit -m "Description of what you changed"

# Push to GitHub
git push origin main
```

### On Server (Pull Changes)

```bash
# SSH into server
ssh user@server-ip

cd /home/user/zoom-bots

# Pull latest code
git pull origin main

# Install new dependencies (if needed)
npm install --production

# Restart bots
pm2 restart zoom-bots
# OR use the script:
./pull-and-restart.sh
```

## 🎯 One-Command Update on Server

```bash
# Use the automated script
cd /home/user/zoom-bots
./pull-and-restart.sh
```

This script will:
- ✅ Pull latest code
- ✅ Install dependencies if needed
- ✅ Restart PM2 process

## 🔑 SSH Key Setup (Optional but Recommended)

### On Server

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "server@zoom-bots"
# Press Enter 3 times

# Copy public key
cat ~/.ssh/id_ed25519.pub
```

### Add to GitHub

1. Go to GitHub → Settings → SSH and GPG keys
2. Click "New SSH key"
3. Paste the key
4. Save

### Update Remote URL

```bash
cd /home/user/zoom-bots
git remote set-url origin git@github.com:YOUR_USERNAME/zoom-bots.git
```

## 📋 Common Commands

```bash
# Check status
git status

# See what changed
git diff

# Undo local changes
git checkout -- .

# View commit history
git log --oneline

# Create new branch
git checkout -b feature-name
```

## ⚠️ Important Notes

1. **Never commit .env file** - It's in .gitignore
2. **Always pull before making changes on server**
3. **Test locally before pushing**
4. **Use meaningful commit messages**

## 🆘 Troubleshooting

### Merge Conflicts

```bash
# If pull fails
git pull origin main

# Resolve conflicts, then:
git add .
git commit -m "Resolved conflicts"
git push origin main
```

### Reset to GitHub Version

```bash
# Discard all local changes
git fetch origin
git reset --hard origin/main
```

