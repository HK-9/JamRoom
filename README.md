# JamRoom

JamRoom is a starter implementation for a **SoundCloud-first group listening room** app with:

- realtime rooms
- shared queue
- room chat
- host controls (play/pause/skip + playback state updates)
- web client and React Native starter client

## Quick start (web + backend)

1. Install dependencies:

```bash
npm install
```

2. Configure env values (already provided in this repo for local testing):

```bash
cp .env.example .env
# or use committed .env directly
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
