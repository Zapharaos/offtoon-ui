# Analytics (umami) - Offtoon

Privacy-friendly, **cookieless** analytics via self-hosted **umami**. Ported from
BrickScanr. The Go backend is **not** involved - the whole analytics plane is: the Angular
`AnalyticsService` (client) + an nginx first-party proxy + an external umami container.

## How it's wired in the app

- [`AnalyticsService`](../src/app/core/services/analytics.service.ts) injects the umami
  `<script>` (browser-only; SSR-safe no-op; **no-op if config empty**) and exposes `track()`.
- Called once from `AppComponent.ngOnInit` (next to `seo.init()`).
- Config lives in `environment(.development).ts` under `umami`:
  | key | meaning |
  |-----|---------|
  | `host` | where the tracker `<script src>` loads from |
  | `scriptName` | script filename (must match what the server serves) |
  | `websiteId` | the site's UUID from the umami dashboard - **empty = analytics disabled** |
  | `hostUrl` | first-party only: `data-host-url`, where events are posted (empty = post to `host`) |
- `data-auto-track="false"` → one manual pageview is sent on load (with UTM params
  extracted then stripped from the URL). Custom events are fired via `analytics.track(...)`.

### Custom events currently tracked

| Event | Where |
|-------|-------|
| `search` / `search-no-results` / `search-error` | `home.component.ts` |
| `download-start` (`source`, `chapters`, `format`) | `download-dialog.component.ts` |
| `outbound-<site>` (`context`) | `toon.component.ts` (View on source) |

## Deployment - first-party (recommended, anti-adblock)

The browser only talks to `offtoon.freits.fr`; the site nginx proxies to umami.

```ts
umami: {
  host:      'https://offtoon.freits.fr',
  scriptName:'stats.js',
  hostUrl:   'https://offtoon.freits.fr',
  websiteId: '<prod-uuid>',   // paste after creating the site in the umami dashboard
}
```

The nginx locations are already prepared in
[`offtoon-backend/nginx-front.conf`](../../offtoon-backend/nginx-front.conf):
`location = /stats.js` → `http://umami:3000/script.js` and `location = /api/send` →
`http://umami:3000` (rate-limited 10 r/s, burst 20). The nginx container must share
umami's Docker network. A `resolver 127.0.0.11` + variable `proxy_pass` means **nginx
still starts if umami isn't deployed yet** (those locations just 502, and are never hit
while `websiteId` is empty).

### Enabling it

1. Deploy a self-hosted umami container reachable as `umami:3000` on the frontend's network.
2. In the umami dashboard: Settings → Websites → add `offtoon.freits.fr`; copy its `websiteId`.
3. Paste `websiteId` into `src/environments/environment.ts`, rebuild (`npm run build:ssg`), redeploy.
4. Verify: `curl -sI https://offtoon.freits.fr/stats.js` → 200; then check the umami
   dashboard → Realtime / Events.

## Privacy

umami is cookieless and stores no personal data or device identifier. The privacy policy
(`privacy.*` in `en-US.json`) has been updated accordingly: anonymous usage analytics only,
no cross-site tracking, no advertising, no profiling, no cookies.
