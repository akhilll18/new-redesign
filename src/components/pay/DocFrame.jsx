// Shows a generated HTML document (payslip, payment advice, invoice, contract) in a sandboxed frame.
// Scripts never run (sandbox without allow-scripts), so organisation-uploaded formats are safe to display.
// The frame grows to its content; print() prints only the document.
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Box } from "@mui/material";

const DocFrame = forwardRef(function DocFrame({ html, title = "Document", minHeight = 420, maxWidth = 860, sx, scale = 1 }, ref) {
  const frame = useRef(null);
  const [h, setH] = useState(minHeight);
  const measure = useCallback(() => {
    try {
      const doc = frame.current?.contentDocument;
      if (doc?.body) setH(Math.max(minHeight, doc.documentElement.scrollHeight + 4));
    } catch {
      /* cross-origin: keep the minimum height */
    }
  }, [minHeight]);
  useImperativeHandle(ref, () => ({
    print() {
      const w = frame.current?.contentWindow;
      if (w) { w.focus(); w.print(); }
    },
    element: () => frame.current,
  }));
  return (
    <Box sx={{ maxWidth, mx: "auto", border: "1px solid #e6ece5", borderRadius: 1, overflow: "hidden", background: "#fff", boxShadow: "0 1px 3px rgba(20,40,30,0.06)", ...sx }}>
      <Box
        component="iframe"
        ref={frame}
        title={title}
        sandbox="allow-same-origin allow-modals"
        srcDoc={html}
        onLoad={() => { measure(); setTimeout(measure, 250); }}
        sx={{ display: "block", width: scale === 1 ? "100%" : `${100 / scale}%`, height: scale === 1 ? h : h, border: 0, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: "0 0", mb: scale === 1 ? 0 : `${-(1 - scale) * h}px` }}
      />
    </Box>
  );
});
export default DocFrame;
