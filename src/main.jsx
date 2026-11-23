import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import AppRoutes from "./routes/AppRoutes.jsx";
import { muiTheme } from "./theme/muiTheme.js";
import { AppStoreProvider } from "./store/AppStore.jsx";
import { CountryProvider } from "./country/CountryContext.jsx";
import { initMobile } from "./lib/mobile.js";
import { detectServer } from "./lib/server/api.js";

initMobile();

// HashRouter keeps deep links working on GitHub Pages and other static hosts (no server rewrites).
// v10.8: ask for an EZY HR server first (≤ 2.5 s); without one the app runs on browser data as before.
detectServer().finally(() => createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AppStoreProvider>
        <CountryProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </CountryProvider>
      </AppStoreProvider>
    </ThemeProvider>
  </React.StrictMode>,
));
