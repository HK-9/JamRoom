#!/usr/bin/env node
/**
 * deploy.js — JamRoom one-command build + deploy pipeline
 *
 * Usage:
 *   node scripts/deploy.js
 *   npm run deploy
 *
 * What it does:
 *   0. Auto-switches to PROD environment (runs setup.js prod)
 *   1. Builds the Vite app from web/ (with VITE_SERVER_URL injected)
 *   2. Deploys web/dist to Netlify production
 *   3. Restores DEV environment (runs setup.js dev)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'web', 'dist');

// ── Step 0: Switch to prod env ────────────────────────────────────────────
console.log('\n╔══════════════════════════════════╗');
console.log('║   JamRoom Deploy Pipeline        ║');
console.log('╚══════════════════════════════════╝\n');

console.log('🔄  Step 0/3 — Switching to PROD environment...\n');
execSync('node scripts/setup.js prod', { cwd: ROOT, stdio: 'inherit' });

// Re-read .env to get the prod VITE_SERVER_URL
const envFile = path.join(ROOT, '.env');
let serverUrl = '';
if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k?.trim() === 'VITE_SERVER_URL') {
            serverUrl = v.join('=').trim();
        }
    }
}

console.log(`\n📡  Backend URL : ${serverUrl}`);
console.log(`📁  Deploy dir  : ${DIST}\n`);

// ── Step 1: Build ────────────────────────────────────────────────────────────
console.log('⚙️  Step 1/3 — Building frontend...\n');
try {
    execSync('node node_modules/vite/bin/vite.js build', {
        cwd: path.join(ROOT, 'web'),
        stdio: 'inherit',
        env: {
            ...process.env,
            VITE_SERVER_URL: serverUrl,
            NODE_ENV: 'production'
        }
    });
} catch (err) {
    console.error('\n❌ Build failed. Restoring dev env...');
    execSync('node scripts/setup.js dev', { cwd: ROOT, stdio: 'pipe' });
    process.exit(1);
}

// Verify dist exists
if (!fs.existsSync(DIST)) {
    console.error(`\n❌ Build succeeded but dist not found at ${DIST}`);
    execSync('node scripts/setup.js dev', { cwd: ROOT, stdio: 'pipe' });
    process.exit(1);
}

// ── Step 2: Deploy to Netlify ──────────────────────────────────────────────
const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const message = `Deploy ${timestamp}`;

console.log(`\n🚀  Step 2/3 — Deploying to Netlify production...\n`);
try {
    execSync(
        `npx netlify-cli deploy --dir="${DIST}" --prod --message="${message}"`,
        {
            cwd: ROOT,
            stdio: 'inherit'
        }
    );
} catch (err) {
    console.error('\n❌ Netlify deploy failed. Restoring dev env...');
    execSync('node scripts/setup.js dev', { cwd: ROOT, stdio: 'pipe' });
    process.exit(1);
}

// ── Step 3: Restore dev env ────────────────────────────────────────────────
console.log('\n🔄  Step 3/3 — Restoring DEV environment...\n');
execSync('node scripts/setup.js dev', { cwd: ROOT, stdio: 'inherit' });

console.log('\n✅  Deploy complete → https://jamroom-app.netlify.app');
console.log('📝  Local env restored to DEV (localhost:4000)\n');
