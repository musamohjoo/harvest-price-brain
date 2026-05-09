# Harvest Price Brain

A deployable website for a predictive dynamic pricing engine focused on agriculture and perishable crop bidding.

## What it shows

- A farmer-facing recommended bid with confidence score.
- Auto market scan that fetches live weather from Open-Meteo and derives crop-season signals.
- A what-if simulator for heatwaves, festival demand, oversupply, and custom manual overrides.
- Forecast curve against a protected margin floor.
- Waste reduction estimate from shelf-life-aware price adjustments.

## stack

The website is frontend-only for easy deployment. It calls the public Open-Meteo forecast API from the browser for weather risk, then combines that with local crop metadata provided beforehand and shelf life .
