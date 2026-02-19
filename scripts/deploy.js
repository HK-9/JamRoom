#!/usr/bin/env node
/**
 * deploy.js — JamRoom one-command build + deploy pipeline
 *
 * Usage:
 *   node scripts/deploy.js
 *   npm run deploy
 *
 * What it does:
 *   1. Builds the Vite app from web/ (with VITE_SERVER_URL injected)
 *   2. Deploys web/dist to Netlify production (always from project root)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'web', 'dist');

// ── Load VITE_SERVER_URL from .env if not already set ──────────────────────
const envFile = path.join(ROOT, '.env');
if (!process.env.VITE_SERVER_URL && fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k?.trim() === 'VITE_SERVER_URL') {
            process.env.VITE_SERVER_URL = v.join('=').trim();
        }
    }
}

const serverUrl = process.env.VITE_SERVER_URL || '';

console.log('\n╔══════════════════════════════════╗');
console.log('║   JamRoom Deploy Pipeline        ║');
console.log('╚══════════════════════════════════╝\n');
console.log(`📡  Backend URL : ${serverUrl || '(same origin — dev mode)'}`);
console.log(`📁  Deploy dir  : ${DIST}\n`);

// ── Step 1: Build ────────────────────────────────────────────────────────────
console.log('⚙️  Step 1/2 — Building frontend...\n');
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
    console.error('\n❌ Build failed. Aborting deploy.');
    process.exit(1);
}

// Verify dist exists
if (!fs.existsSync(DIST)) {
    console.error(`\n❌ Build succeeded but dist not found at ${DIST}`);
    process.exit(1);
}

// ── Step 2: Deploy to Netlify ──────────────────────────────────────────────
const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const message = `Deploy ${timestamp}`;

console.log(`\n🚀  Step 2/2 — Deploying to Netlify production...\n`);
try {
    // Always run from ROOT so netlify.toml paths are correct
    execSync(
        `npx netlify-cli deploy --dir="${DIST}" --prod --message="${message}"`,
        {
            cwd: ROOT,   // ← CRITICAL: always from project root
            stdio: 'inherit'
        }
    );
} catch (err) {
    console.error('\n❌ Netlify deploy failed.');
    process.exit(1);
}

console.log('\n✅  Deploy complete → https://jamroom-app.netlify.app\n');
