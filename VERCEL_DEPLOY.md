# StationMitra — Vercel Auth/Login Fix

## What is fixed
This package uses the Phase 9 StationMitra source whose `src/App.jsx` contains the Supabase Auth LoginScreen. It does NOT use the old 4-step onboarding HTML currently served by `stationmitraverificationfixv2-oigwvikai.vercel.app`.

## Vercel Environment Variables
Set these in Project Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (browser-safe Publishable key may be used as the value)
- `VITE_PUMPPRO_STATION_ID`

Do not add service_role/secret keys to Vercel frontend variables.

## Deploy
Upload/import this folder as the source for the existing StationMitra Vercel project and deploy to Production. After deployment, the first screen should be `PumpPro` Login with `Username / Email` and `Password`, not `STEP 1 OF 4` onboarding.

## Verification
1. Open production URL in an incognito/private window.
2. Confirm Login screen appears.
3. Sign in with the existing Supabase Admin account.
4. Confirm Dashboard loads.
5. Confirm cloud data loads/saves.

Do not disable Supabase legacy API keys until production login + cloud save/load are verified.
