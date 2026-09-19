// /api-docs — Swagger UI page.
// Server-rendered HTML that loads Swagger UI from local static assets
// (served from `/swagger-ui/...` via the `public/` folder) and points it
// at our `/api/docs` OpenAPI 3.1 JSON.
//
// We bundle Swagger UI locally rather than loading it from a CDN so that
// (a) the page works in environments with no outbound network access
// and (b) the script-tag's UMD global assignment isn't blocked by any
// cross-origin CSP that a hosting platform might apply.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mining Compliance Management API — Swagger UI</title>
  <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *::before, *::after { box-sizing: inherit; }
    body { margin: 0; background: #fafbfc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    header {
      background: #1f2937; color: #fff; padding: 16px 24px; display: flex;
      align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.15);
    }
    header h1 { font-size: 16px; font-weight: 600; margin: 0; letter-spacing: .02em; }
    header .meta { font-size: 12px; opacity: .75; margin-left: auto; }
    header a { color: #93c5fd; text-decoration: none; font-size: 12px; }
    header a:hover { text-decoration: underline; }
    #swagger-ui { max-width: 1400px; margin: 0 auto; background: #fff; min-height: calc(100vh - 56px); box-shadow: 0 0 1px rgba(0,0,0,.08); }
  </style>
</head>
<body>
  <header>
    <h1>Mining Compliance Management API</h1>
    <span class="meta">OpenAPI 3.1 · <a href="/api/docs" target="_blank" rel="noopener">/api/docs (raw JSON)</a></span>
  </header>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script>
    window.addEventListener('load', function () {
      window.ui = SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
      });
    });
  </script>
</body>
</html>`;

export async function GET(_req: NextRequest) {
  return new NextResponse(HTML, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
