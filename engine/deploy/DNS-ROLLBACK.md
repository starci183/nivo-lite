# DNS: VPS cutover and rollback (nivo.vn)

The app runs on the VPS (Docker: Traefik edge `~/nivo-edge` -> `~/nivo-web`) and on Netlify (hot fallback, reachable at `https://nivo-os.netlify.app`).
Zone `nivo.vn` is on Cloudflare. Token: `CLOUDFLARE_API_TOKEN` in `secrets.env` section `[cloudflare]`.

## State before the cutover (recorded 2026-10-02)

| Type  | Name       | Content                | Proxied | TTL  |
|-------|------------|------------------------|---------|------|
| A     | nivo.vn    | 75.2.60.5 (Netlify)    | yes     | auto |
| CNAME | www.nivo.vn| nivo.vn                | yes     | auto |
| CNAME | webmail.nivo.vn | nivo.vn           | yes     | auto |

Added for the VPS (DNS only, TTL 60): `app-vps.nivo.vn`, `n8n.nivo.vn`, `engine.nivo.vn` -> 103.142.27.9.
Note: `*.nivo.vn` -> 180.93.136.138 is a wildcard that other systems use; explicit records win over it.
`webmail.nivo.vn` is a proxied CNAME to the apex: after the cutover it follows the apex to the VPS (it is not served by the app).

## Cutover (what was done)

1. `node scripts/with-secrets.mjs node engine/deploy/dns-rollback.mjs --forward`: A nivo.vn -> 103.142.27.9, DNS only, TTL 60.
2. Add `nivo.vn` and `www.nivo.vn` to the `web` router in `deploy/edge/dynamic/routes.yml` (Traefik hot-reloads and gets the certificates by HTTP-01).
3. The apex is NOT proxied through Cloudflare (proxying would need an SSL-mode check first). `www` is a CNAME to `nivo.vn`, so it is DNS only after the flip is complete.

## Rollback (one command, ~1 minute plus the resolver cache)

```
node scripts/with-secrets.mjs node engine/deploy/dns-rollback.mjs
```

sets A nivo.vn back to 75.2.60.5, proxied (the table above). Netlify keeps deploying every push, so it is always current.
By hand: Cloudflare dashboard > DNS > the A record `nivo.vn` > content 75.2.60.5, Proxied on, TTL Auto.
