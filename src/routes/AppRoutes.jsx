import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage.jsx";
import WelcomePage from "../pages/WelcomePage.jsx";
// v10.8: the signed-in app loads only after sign-in, so the public pages (welcome, pricing, sign-in) stay light and fast.
const PeopleHubApp = lazy(() => import("../PeopleHubApp.jsx"));
const Loading = () => (
  <div role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center",  color: "#17404D" }}>Loading your workspace…</div>
);
import { useStore } from "../store/AppStore.jsx";

// Session comes from the store (role-based sign-in with MFA, lockout and idle timeout).
function ProtectedRoute({ children }) {
  const { session, user } = useStore();
  // v10.7: first-time visitors land on Contact → employee count → pricing; returning users sign in from there.
  if (!session || !user) return <Navigate to="/welcome" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/organization/login" element={<Navigate to="/login" replace />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Suspense fallback={<Loading />}>
              <PeopleHubApp />
            </Suspense>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
