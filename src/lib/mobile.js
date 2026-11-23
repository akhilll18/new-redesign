// v10.3 — one code base for web, iOS and Android.
// • Web: installable PWA (manifest + service worker, offline app shell); the "Add web app to home screen" button uses the
//   browser's install prompt when it is available.
// • iOS / Android: the same build wrapped with Capacitor (ios/ and android/ projects; `npm run ios` / `npm run android`).
//   Native status bar and splash colours follow the Ezyo palette; GPS punches use the device location permission.
import { Capacitor } from "@capacitor/core";

export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };
export const platform = () => { try { return Capacitor.getPlatform(); } catch { return "web"; } };

let deferredPrompt = null;

export function initMobile() {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.platform = platform();
  if (isNative()) {
    import("@capacitor/status-bar").then(({ StatusBar, Style }) => { StatusBar.setStyle({ style: Style.Dark }).catch(() => {}); StatusBar.setBackgroundColor?.({ color: "#15414F" }).catch?.(() => {}); }).catch(() => {});
    import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide().catch(() => {})).catch(() => {});
    return;
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
  // The "Add web app to home screen" button in My app fires this event.
  window.addEventListener("peoplehub-install", () => { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; } });
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !import.meta.env.DEV) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
}
