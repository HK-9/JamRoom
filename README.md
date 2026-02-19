# JamRoom

JamRoom is a starter implementation for a **SoundCloud-first group listening room** app with:

- realtime rooms
- shared queue
- room chat
- host controls (play/pause/skip + playback state updates)
- web client and React Native starter client

## What was improved

- safer defaults via `.gitignore` to avoid committing local secrets
- better room state snapshots (`nowPlaying` included)
- host-only playback control actions with explicit play/pause
- mobile socket lifecycle fix to prevent stale listeners and reconnection issues

## Quick start (web + backend)

1. Install dependencies:

```bash
npm install
```

2. Configure env values:

```bash
cp .env.example .env
```

3. Run server:

```bash
npm run dev
```

4. Open http://localhost:4000

## API endpoints

- `GET /health`
- `GET /api/search?q=<query>`

## Socket events

- `room:join` `{ roomId, name }`
- `room:state` full room snapshot from server
- `queue:add` `{ roomId, track, addedBy }`
- `queue:skip` `{ roomId }` (host only)
- `player:update` `{ roomId, state, positionMs }` (host only)
- `chat:send` `{ roomId, text }`
- `chat:new` message broadcast

## Mobile (React Native / Expo)

A starter app exists in `mobile/`.

```bash
cd mobile
npm install
npm run start
```

Set server URL to your machine-accessible backend URL.
