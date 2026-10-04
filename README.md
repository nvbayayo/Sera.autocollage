# Sera.autocollage

A browser-based screenshot collage maker for MLBB collections.

## Features

- Multi-image upload
- Automatic card/grid detection
- Automatic sequence generation
- Manual reorder
- Drag/drop swap
- Remove individual cards
- Adjustable columns, gap and padding
- 2K / 4K / 8K / 10K / 16K export presets
- PNG lossless export
- JPEG export with adjustable quality
- Local processing: uploaded images are not sent to a server
- Works on desktop and mobile browsers

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints.

## Build

```bash
npm run build
```

The `dist` folder can be deployed to Vercel, Netlify, Cloudflare Pages, or similar static hosting.

## Detection

The detector is intentionally dependency-free. It looks for repeated rectangular regions using image luminance/color transitions and falls back to a regular grid when a screenshot has a uniform layout.

Target detection time is approximately 1–2 minutes for 400–500 skins on a capable device. For extremely different MLBB screenshots, the Manual mode remains available for correcting the detected sequence.

## Quality

PNG export is lossless. The app never applies filters or sharpening. Exporting above the source dimensions cannot create new detail; it only creates a larger canvas. For maximum clarity, use PNG and choose a size at or below the effective source detail when possible.
