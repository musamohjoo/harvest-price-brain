# Harvest Price Brain

A deployable website for a predictive dynamic pricing engine focused on agriculture and perishable crop bidding.

## What it shows

- A farmer-facing recommended bid with confidence score.
- Auto market scan that fetches live weather from Open-Meteo and derives crop-season signals.
- A what-if simulator for heatwaves, festival demand, oversupply, and custom manual overrides.
- Forecast curve against a protected margin floor.
- Waste reduction estimate from shelf-life-aware price adjustments.

## Data behavior

The website is frontend-only for easy deployment. It calls the public Open-Meteo forecast API from the browser for weather risk, then combines that with local crop metadata for seasonal demand, festival demand, stock pressure, logistics pressure, and shelf life. If the weather request fails, it falls back to seasonal estimates so the pricing tool still works.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

This project is ready for direct Vercel deployment.

### Vercel settings

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

The included `vercel.json` sets the same build/output settings and rewrites every route back to `index.html`, so page refreshes and direct links work correctly.

### Quick deploy

```bash
npm install
npm run build
```

Then import this folder into Vercel, or push it to GitHub and import the repository.
