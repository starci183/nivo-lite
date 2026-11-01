# DNS for nivo.vn (Tino): cutover and rollback

The zone `nivo.vn` is hosted at **Tino** (nameservers `ns1.tino.vn`, `ns2.tino.vn`), not at Cloudflare. DNS is edited by hand in the Tino panel by the owner; there is no script, API token or credential for it in this repository, and none may be added for a provider the zone is not on.

## Records the product needs

| Type | Name          | Content        | Notes                                                                         |
| ---- | ------------- | -------------- | ----------------------------------------------------------------------------- |
| A    | `nivo.vn`     | `103.142.27.9` | the landing through the VPS (Traefik edge); TTL 300 or lower during a cutover |
| A    | `www.nivo.vn` | `103.142.27.9` | the same landing through the edge                                             |
| A    | `app.nivo.vn` | `103.142.27.9` | the console (`web` service) through the edge; TTL 300                         |
| A    | `api.nivo.vn` | `103.142.27.9` | the API host through the edge; TTL 300                                        |

`app-vps.nivo.vn`, `engine.nivo.vn` and `n8n.nivo.vn` do not exist and are optional (not required by any config; `n8n.` stays a commented entry in the edge routes). `*.nivo.vn` may resolve to another address for other systems; explicit records win over a wildcard.

## Before the cutover: write the current values down

In the Tino panel record, outside git (password manager or the owner's notes), the current content and TTL of the apex A record and of `www`. These are the rollback values. Keep the Tino account and its 2FA custody outside git as well.

## Cutover

All four hosts already have A records pointing at the VPS. Verify `nivo.vn`, `www.nivo.vn`, `app.nivo.vn` and `api.nivo.vn` with `nslookup <host> 1.1.1.1` before the cutover; the edge obtains a Let's Encrypt certificate for each host on its first request. **Deploy stack** serves the landing on the apex and `www`, the console on `app`, and the API on `api`. Check `https://nivo.vn/health/live` and `https://www.nivo.vn/health/live` for the landing and `https://app.nivo.vn/health/live` for the console. If a record has to change: edit it in the Tino panel, set a short TTL first (300 s) and wait for the old TTL to expire before the switch.

At cutover, set `AUTH_WEB_ORIGIN` and `AUTH_GOOGLE_CALLBACK_URL` (`https://api.nivo.vn/auth/google/callback`) to the new hosts, and add that callback to the Google OAuth client's authorized redirect URIs; keep the old hosts there for links sent before cutover.

## Rollback

DNS is only part of a rollback if the VPS itself is lost. In the Tino panel set the apex A record (and `www`) back to the values written down before the cutover; resolvers follow after the TTL. The previous hot fallback (Netlify) builds nothing after auto publishing was stopped: use "Publish deploy" on its last pre-cutover deploy. Verify with `nslookup nivo.vn 1.1.1.1` and `curl -I https://nivo.vn`.
