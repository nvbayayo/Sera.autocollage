# Sera AutoCollage — MLBB Automatic Skin Detector

JavaScript + Next.js 15 project, ready for Vercel.

## What this version does
- Upload multiple MLBB screenshots.
- Upload a screen recording (`MP4/WebM`) and sample frames automatically.
- Detect repeating card grids and crop individual skin cards.
- Merge cards from all inputs.
- Remove near-duplicate cards using perceptual image signatures.
- Show a mobile-style detected-skins workflow inspired by the supplied reference video.
- Manual tab for basic correction and reordering.
- Compact dense collage preview.
- PNG/WebP export.
- 2K / 4K / 8K / 10K / 16K export presets.
- Runs entirely in the browser; no API key is required.

## Important
This is visual card detection, not a complete official MLBB skin-name database. The UI displays confidence as a visual matching estimate. A true name-matching system requires a maintained skin catalogue/reference dataset.

## Run
```bash
npm install
npm run dev
```

## Vercel
Push the folder to GitHub and import it into Vercel. Framework: Next.js. Build command: `next build`.
