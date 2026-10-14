# DNS for nivo.vn (Tino): cutover and rollback

The zone `nivo.vn` is hosted at **Tino** (nameservers `ns1.tino.vn`, `ns2.tino.vn`), not at Cloudflare. DNS is edited by hand in the Tino panel by the owner; there is no script, API token or credential for it in this repository, and none may be added for a provider the zone is not on.

## Records the product needs

| Type       | Name          | Content                    | Notes                                                                     |
| ---------- | ------------- | -------------------------- | ------------------------------------------------------------------------- |
| A          | `nivo.vn`     | `103.142.27.9`             | the VPS (Traefik edge); TTL 300 or lower during a cutover                 |
| A or CNAME | `www.nivo.vn` | `103.142.27.9` / `nivo.vn` | served by the same edge router                                            |
| A          | `api.nivo.vn` | `103.142.27.9`             | the API host; **add it before the cutover** (manual, Tino panel); TTL 300 |

`app-vps.nivo.vn`, `engine.nivo.vn` and `n8n.nivo.vn` do not exist and are optional (not required by any config; `n8n.` stays a commented entry in the edge routes). `*.nivo.vn` may resolve to another address for other systems; explicit records win over a wildcard.

## Before the cutover: write the current values down

In the Tino panel record, outside git (password manager or the owner's notes), the current content and TTL of the apex A record and of `www`. These are the rollback values. Keep the Tino account and its 2FA custody outside git as well.

## Cutover

The apex already points at the VPS. The one record to add is **`api.nivo.vn` A `103.142.27.9`** in the Tino panel (owner step; nothing is scripted for DNS), then wait until `nslookup api.nivo.vn 1.1.1.1` answers; the edge obtains the certificate on the first request. No other DNS change (the edge serves the new routes after **Deploy edge**). If a record has to change: edit it in the Tino panel, set a short TTL first (300 s) and wait for the old TTL to expire before the switch.

## Rollback

DNS is only part of a rollback if the VPS itself is lost. In the Tino panel set the apex A record (and `www`) back to the values written down before the cutover; resolvers follow after the TTL. The previous hot fallback (Netlify) builds nothing after auto publishing was stopped: use "Publish deploy" on its last pre-cutover deploy. Verify with `nslookup nivo.vn 1.1.1.1` and `curl -I https://nivo.vn`.
