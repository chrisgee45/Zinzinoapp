// Open a clean print window with just the workbook content. iOS Safari and
// modern Chrome surface a 'Save as PDF' destination in the print dialog,
// so the same window.print() call covers both physical print and PDF save.
//
// We render the content into a hidden iframe to isolate it from the rest of
// the app's styles, then trigger print on that iframe. This avoids the
// site's nav and sidebar appearing on the printed page.

export function printDocument({
  title,
  bodyHtml,
  styles,
}: {
  title: string;
  bodyHtml: string;
  styles?: string;
}): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #0b1f33;
        background: #ffffff;
        margin: 0;
        padding: 2rem;
        line-height: 1.55;
      }
      h1 { font-size: 1.8rem; margin: 0 0 0.5rem; }
      .eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.18em; color: #c9a84c; margin-bottom: 0.5rem; }
      .body-text { white-space: pre-wrap; font-size: 1rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem; }
      th, td { border: 1px solid #cccccc; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
      th { background: #f3f3f3; font-weight: 600; }
      td.num { text-align: center; color: #888; font-weight: 600; width: 3ch; }
      .meta { color: #666; font-size: 0.8rem; margin-bottom: 1rem; }
      ${styles ?? ""}
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`);
  doc.close();

  // Give the browser a tick to render before triggering print.
  window.setTimeout(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      // Clean up after the print dialog closes. afterprint fires reliably
      // on Chrome/Safari/Firefox; setTimeout is a safety net.
      const remove = () => {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      };
      frame.contentWindow?.addEventListener("afterprint", remove);
      window.setTimeout(remove, 60_000);
    }
  }, 100);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export { escapeHtml as escapePrintHtml };
