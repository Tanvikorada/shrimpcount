# ShrimpCount landing page

Static page (no build step): `index.html`, `styles.css`, `main.js`. GSAP, fonts and icons load from CDNs.

- Preview: `python -m http.server 5200 --directory landing`
- Public site: https://shrimpcount-ai.vercel.app (Vercel project `shrimpcount-ai`, free tier)
- Deploy: `cd landing && npx vercel deploy --prod --yes`
- Media in `media/` was encoded with the ffmpeg from `imageio-ffmpeg` in `.venv`. The hero film is keyframed every 8 frames so scrolling can jump through it smoothly.
- Contact button: set `CONTACT_EMAIL` at the top of `main.js`. While it is empty, the "Talk about a pilot" button stays hidden.

The hero tray is a canvas illustration. The counter shows how many dots the page itself draws, not a real result. No accuracy numbers go on this page until they come from `eval/` on held-out batches.

Later, when Higgsfield credits are available: a generated hero film can replace or sit behind the canvas in `.stage-visual`.

## Higgsfield copy (2026-09-26)
Same page, ported to a Higgsfield website: https://shrimpcount-ai.higgsfield.app (website id `520071fc-1f0c-425d-ac7d-5ae3c47c7b9f`).
It lives in Higgsfield's own repo (TanStack Start): `app/src/routes/index.tsx`, `app/src/landing.css`, `app/src/lib/tray.ts`. Changes made here in `landing/` do NOT sync there.
Built with 0 credits: no generated images. Not listed on the Higgsfield feed. On first check the URL redirected to a Higgsfield sign-in page.

## Higgsfield version v2 (2026-09-26): stock footage + Canva
The Higgsfield site now uses real media: drone film over shrimp ponds (Pexels 35295069) scrubbed by scroll, plus loops of Pexels 35295056 (ponds), 4857285 (prawn tank) and 32402591 (lab). Tray, hatchery, phone and delivery photos are Canva AI images (Canva design "ShrimpCount site photos", DAHWRZ0TRwE), and the footer says so.
Files in the Higgsfield repo: `app/public/media/*`, `app/src/media.css`, `app/src/lib/film.ts`, `app/src/components/landing/Lower.tsx`. `landing/` now matches it and is the public copy (Vercel). The Higgsfield copy only opens for signed-in Higgsfield users.
The site answers 401 to anyone not signed in to Higgsfield.

## v4 (2026-09-26)
Sections: hatchery scroll story (circle wipes, real counter marks, real app screen), install (Android/iPhone/QR, sign in), how it works (sticky phone with real screens), compare slider, features, farmer drone film, hatchery/farmer tabs + table, app tour, all extra tools, accuracy, pricing, engineering, students, FAQ, contact.
Language switch uses `i18n.json`, exported from `web/src/lib/i18n.js`. Re-export it with node if the app's text changes.
App screenshots in `media/app/` came from the live app (Playwright, Demo Hatchery). Retake them when the app UI changes.

## v5 (2026-09-26): one site
The app is built into `app/` and served at `/app/`:

    cd web && MSYS_NO_PATHCONV=1 VITE_BASE=/app/ VITE_API_URL=https://shrimpcount-api.vercel.app npx vite build --outDir ../landing/app --emptyOutDir

Then `cd landing && npx vercel deploy --prod --yes`. The root `manifest.webmanifest` points at `/app/`, so Install works from the homepage.
The page code is in `site.js` (three.js hero, GSAP + Lenis). `media/layers/` holds real processing stages of the tray image.
