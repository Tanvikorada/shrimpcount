# Putting ShrimpCount on the Google Play Store

The app is already an installable web app (a PWA). Play accepts it wrapped as a "Trusted Web Activity": a thin Android shell
that opens https://shrimpcount-ai.vercel.app/app/ full screen, with no browser bar. Nothing about the app itself changes.
Updates to the website reach installed phones automatically; the Play package only needs rebuilding if the icon, name or
package settings change.

What is ready: `tools/android/twa-manifest.json` (the shell's settings), the public privacy page
https://shrimpcount-ai.vercel.app/privacy.html (Play requires one), the icons, and the listing text below.

What only you can do: pay the one-time US$25 Google Play developer fee, verify your identity, and own the signing key.

## Steps

1. **Play Console account.** https://play.google.com/console, one-time US$25, identity verification (can take a few days).
   Google has required new personal accounts to run a closed test (about 12 testers for 14 days) before publishing to everyone. Check the current rule in the Console.
2. **Build the package** (either way produces an `.aab` file):
   - *No tools needed:* go to https://www.pwabuilder.com, enter `https://shrimpcount-ai.vercel.app/app/`, choose Android, and
     use the settings in `tools/android/twa-manifest.json` (package id `com.shrimpcount.app`, start URL `/app/`, colours `#0B0E10`).
     Let it create the signing key and **download and keep the keystore and its passwords**; losing them means you cannot update the app.
   - *On a computer:* `npm i -g @bubblewrap/cli`, then in `tools/android/` run `bubblewrap init --manifest=twa-manifest.json`
     and `bubblewrap build`. Bubblewrap downloads JDK 17 and the Android SDK itself and asks you for a keystore password.
3. **Create the app** in Play Console (name ShrimpCount, free, app not game), upload the `.aab` to an Internal or Closed test track.
   Choose **Play App Signing** when asked.
4. **Link the app to the website** (this is what hides the browser bar). In Play Console open
   Setup, App signing and copy the **SHA-256 certificate fingerprint**. Create `landing/.well-known/assetlinks.json`:

       [{
         "relation": ["delegate_permission/common.handle_all_urls"],
         "target": {
           "namespace": "android_app",
           "package_name": "com.shrimpcount.app",
           "sha256_cert_fingerprints": ["PASTE:THE:FINGERPRINT:HERE"]
         }
       }]

   then redeploy the website (`cd landing && npx vercel deploy --prod --yes`) and check
   https://shrimpcount-ai.vercel.app/.well-known/assetlinks.json opens. Without it the app opens with a browser bar.
   If you also use the upload key's fingerprint for testing, list both fingerprints.
5. **Store listing, data safety, content rating** (answers below), then submit.

**The package id `com.shrimpcount.app` is permanent once published.** Change it in `twa-manifest.json` first if you want another.

## Listing text (honest on purpose; do not add accuracy claims)

**Short description (80 characters max):** Count shrimp postlarvae from a photo of the tray. English, Telugu, Hindi, Tamil.

**Full description:**

> ShrimpCount helps hatcheries count postlarvae (PL) from a photo of a sample tray.
>
> - Take a photo of the tray. Every counted larva is marked, so you can check it. Tap to remove a wrong mark or add a missed one.
> - The count is an estimate from a photo. It can read low where larvae overlap in a packed tray, and it has been tested on only a few trays so far. Compare with your own hand count before you rely on it for a sale.
> - Keep batches, count history, orders and water readings, and print a count report, delivery certificate and invoice.
> - Works in English, Telugu, Hindi and Tamil.
> - You can count by tapping even with no signal; the automatic count needs a connection.
> - Optional hatchery account: backs up your records and photos to a private space only your team can open.
>
> Currently in pilot with hatcheries. Contact us for access: tanvikorada@gmail.com

**Privacy policy URL:** https://shrimpcount-ai.vercel.app/privacy.html
**Category:** Business (or Productivity). **Contact email:** tanvikorada@gmail.com.

## Data safety form (match `landing/privacy.html`)

- Data collected: **Email address** (only if the person makes an account); **Photos** (the marked count photo, stored in the hatchery's private backup only if they have an account); **App activity / other user content** (counts, batches, orders the person saves).
- Shared with third parties: **No**. Sold: **No**.
- Encrypted in transit: **Yes**. Users can request deletion: **Yes** (in the app for a count; by email for the whole account).
- Location, contacts, financial info, health, device IDs, advertising ID: **not collected**.
- Permissions: **Camera** only.

## Screenshots and graphics

Phone screenshots (at least 2, 16:9 to 9:16): `landing/media/app/*.jpg`. Retake them if the app's look changes.
Icon: `landing/app/icon-512.png`. Feature graphic (1024x500): `tools/android/feature-graphic.png`, redrawn by `tools/android/make_feature_graphic.py`.
