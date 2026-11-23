# Ezyo HRMS on web, iOS and Android

One React code base ships three ways.

## Web (desktop & mobile browsers)
```
npm install
npm run build        # dist/ — static files, host anywhere (base "./", HashRouter)
npm start            # build + AI proxy (server/ai-proxy.mjs) on one port
```
The web build is an installable PWA: `public/manifest.webmanifest`, `public/sw.js` (offline app shell), icons in
`public/brand/`. Chrome/Edge/Android show "Install"; on iPhone use Share → Add to Home Screen. The *Mobile app* page's
"Add web app to home screen" button triggers the browser's install prompt where supported.

## Android (Capacitor 8)
Needs Android Studio + JDK 21.
```
npm run android      # vite build → cap sync android → opens Android Studio
```
Then Build → Generate Signed Bundle / APK. App id `com.ezyo.hrms`, name "Ezyo HRMS". Location and camera permissions
are declared for GPS / selfie punches and receipt photos.

## iOS (Capacitor 8)
Needs a Mac with Xcode 16+.
```
npm run ios          # vite build → cap sync ios → opens Xcode
```
Set your signing team, then Product → Archive. Info.plist carries the location / camera / photo usage texts.

## After changing the web app
`npm run mobile:sync` copies the new build into both native projects.
`npm run mobile:icons` regenerates icons and splash screens from `assets/` (icon-only.png, icon-foreground.png,
icon-background.png, splash.png).

## Server (v10.8 database edition)
In the app: **Sign in → Connect to a server** → your server address (e.g. `https://hr.yourcompany.com`), once per
device. Or build with `VITE_API_URL=https://hr.yourcompany.com npm run mobile:sync` so it is preset. With a server,
data lives in PostgreSQL (see DATABASE.md); without one, the app keeps the browser-edition demo data on the device.
