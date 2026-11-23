// v10.3: runs the AI automation engine in the background while anyone is signed in (on sign-in, then every 5 minutes).
// In production the same rules run on the server on a schedule; this keeps the demo self-contained.
import { useEffect, useRef } from "react";
import { useStore } from "../../store/AppStore.jsx";

export default function AutomationRunner() {
  const { user, runAutomation } = useStore();
  const ref = useRef(runAutomation);
  ref.current = runAutomation;
  useEffect(() => {
    if (!user) return undefined;
    const tick = () => { try { ref.current(); } catch { /* never break the page */ } };
    const first = setTimeout(tick, 2500);
    const t = setInterval(tick, 5 * 60000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [user?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
