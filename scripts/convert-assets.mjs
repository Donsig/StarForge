#!/usr/bin/env node
/**
 * convert-assets.mjs
 * Converts PNG/JPG images to webp and resizes them for StarForge assets.
 *
 * Usage:
 *   node scripts/convert-assets.mjs <input> <output> [width] [height]
 *
 * Examples:
 *   # Panel banner (896×512)
 *   node scripts/convert-assets.mjs ~/Downloads/fleet.png public/assets/panels/fleet.webp
 *
 *   # Card banner (896×512)
 *   node scripts/convert-assets.mjs ~/Downloads/metalMine.png public/assets/buildings/metalMine.webp
 *
 *   # Planet portrait (512×512)
 *   node scripts/convert-assets.mjs ~/Downloads/hot.png public/assets/planets/hot.webp 512 512
 *
 *   # Planet icon (128×128)
 *   node scripts/convert-assets.mjs ~/Downloads/hot.png public/assets/planets/hot-icon.webp 128 128
 *
 * Default size is 896×512 (panel/card banners).
 * Install sharp once: npm install --save-dev sharp
 */

import sharp from 'sharp';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const [,, input, output, widthArg, heightArg] = process.argv;

if (!input || !output) {
  console.error('Usage: node scripts/convert-assets.mjs <input> <output> [width] [height]');
  process.exit(1);
}

const width  = parseInt(widthArg  ?? '896', 10);
const height = parseInt(heightArg ?? '512', 10);

// Resolve ~ on Windows/Unix
const resolvedInput = input.replace(/^~/, process.env.HOME ?? process.env.USERPROFILE ?? '');
const resolvedOutput = path.resolve(output);

// Ensure output directory exists
const outDir = path.dirname(resolvedOutput);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

console.log(`Converting: ${resolvedInput}`);
console.log(`       → ${resolvedOutput} (${width}×${height} webp)`);

await sharp(resolvedInput)
  .resize(width, height, { fit: 'cover', position: 'centre' })
  .webp({ quality: 85 })
  .toFile(resolvedOutput);

console.log('Done.');
