#!/usr/bin/env node
// Rasterizes public/icons/icon.svg into the PNG set the web manifest needs.
// Output is committed, so this only needs to run when the SVG changes:
//   npm run icons

import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');
const SVG = readFileSync(join(ICONS_DIR, 'icon.svg'));

// The icon's own background color (used for full-bleed variants).
const BG = '#5A0000';

mkdirSync(ICONS_DIR, { recursive: true });

async function transparent(size, out) {
  await sharp(SVG, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(join(ICONS_DIR, out));
  console.log(`✓ ${out}`);
}

// Maskable icons get cropped to arbitrary shapes; keep the artwork inside the
// 80% safe zone on a full-bleed background.
async function fullBleed(size, artScale, out) {
  const art = await sharp(SVG, { density: 300 })
    .resize(Math.round(size * artScale), Math.round(size * artScale))
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(join(ICONS_DIR, out));
  console.log(`✓ ${out}`);
}

await transparent(512, 'icon-512.png');
await transparent(192, 'icon-192.png');
await fullBleed(512, 0.8, 'icon-maskable-512.png');
await fullBleed(180, 0.85, 'apple-touch-icon.png');
