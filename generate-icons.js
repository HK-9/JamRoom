// generate-icons.js — creates PNG icons for JamRoom PWA
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.join(__dirname, 'web', 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const tBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([tBuf, data])), 0);
    return Buffer.concat([len, tBuf, data, crcBuf]);
}

function createPNG(size) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; ihdr[9] = 2; // 8-bit depth, RGB truecolor

    // Build raw scanlines
    const rowBytes = 3 * size;
    const raw = Buffer.alloc(size * (rowBytes + 1));
    const cx = size / 2, cy = size / 2;
    const maxDist = size / 2;

    for (let y = 0; y < size; y++) {
        const rowStart = y * (rowBytes + 1);
        raw[rowStart] = 0; // filter none
        for (let x = 0; x < size; x++) {
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
            const t = Math.max(0, 1 - dist * 1.2);

            // Dark navy bg (#0d0d1a) → vibrant blue (#1677ff) at center
            const r = Math.min(255, Math.round(13 + t * (22 - 13) + t * t * 60));
            const g = Math.min(255, Math.round(13 + t * (119 - 13) + t * t * 20));
            const b = Math.min(255, Math.round(26 + t * (255 - 26)));

            // Draw equalizer bars on top
            const relX = (x / size);
            const relY = (y / size);
            const bars = [
                { cx: 0.22, h: 0.40 },
                { cx: 0.34, h: 0.60 },
                { cx: 0.46, h: 0.78 },
                { cx: 0.58, h: 0.60 },
                { cx: 0.70, h: 0.44 },
                { cx: 0.82, h: 0.30 },
            ];
            let isBar = false;
            for (const bar of bars) {
                const barTop = 0.5 - bar.h / 2;
                const barBot = 0.5 + bar.h / 2;
                if (Math.abs(relX - bar.cx) < 0.045 && relY >= barTop && relY <= barBot) {
                    isBar = true; break;
                }
            }

            raw[rowStart + 1 + x * 3] = isBar ? 22 : r;
            raw[rowStart + 1 + x * 3 + 1] = isBar ? 119 : g;
            raw[rowStart + 1 + x * 3 + 2] = isBar ? 255 : b;
        }
    }

    const compressed = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

[192, 512, 180].forEach(sz => {
    const png = createPNG(sz);
    const name = sz === 180 ? 'apple-touch-icon.png' : `icon-${sz}.png`;
    fs.writeFileSync(path.join(iconsDir, name), png);
    console.log(`Created ${name} (${png.length} bytes)`);
});

console.log('All icons generated.');
