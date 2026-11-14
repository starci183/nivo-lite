import type { HttpMethod } from "./tino.contracts"

/**
 * THE TINO OPERATIONS NIVO CALLS, each from Tino's public API documentation (read 2026-11-13, no live call made):
 * - the machine-readable reference (every route, its members and its example answers): https://docs.tino.vn/openapi.json
 * - the route pages: https://docs.tino.vn/docs/api/<route slug> (named on each operation below), the product index
 *   https://docs.tino.vn/docs/domains
 * - auth and errors: https://docs.tino.vn/docs/api (header `Authorization: Bearer <token>`; a personal API token `tinopat_...` created at
 *   https://auth.tino.vn/me/security with the scopes the routes name; https://docs.tino.vn/docs/personal-tokens). A gateway refusal is
 *   `{"error": ["<code>"]}` with 401 `invalid_token` or 403 `insufficient_scope` / `ip_not_allowed` / `ipnotallowed`; a route's own
 *   business refusal is usually HTTP 200 with `{"error": ["<code>"]}`, a success often `{"info": ["<code>"]}`.
 * Base: `https://api.tino.vn` (the OpenAPI `servers`), every route under `/v1`. The `@id` of a route is the domain's Tino id.
 *
 * The NAME of each operation is `nivo.api.tino.<operationId in kebab case>` (Tino's own ids, `post_domain_lookup` → `post-domain-lookup`).
 */
export interface TinoOperation {
    /** The operation's NIVO name. */
    readonly api: `nivo.api.tino.${string}`
    /** The HTTP method. */
    readonly method: HttpMethod
    /** The path below the base, `{param}` for a path parameter. */
    readonly path: string
}

/** The operations, by a stable name (the adapter writes `TINO_OPS.domainLookup`, never the path). */
export const TINO_OPS = {
    /**
     * `get_domain` (docs/api/get-domain), scope `domains:read`: query `page` (0-based), `perpage`. Answer `{ success, domains[{ id,
     * name, expires, status, autorenew, ... }] }`.
     */
    domainList: { api: "nivo.api.tino.get-domain", method: "GET", path: "/v1/domain" },
    /**
     * `get_domain_name_name` (docs/api/get-domain-name-name), scope `domains:read`: path `name`. Answer `{ success, domains[{ id, name,
     * expires, status, nameservers[], autorenew, ... }], page{ current, total } }`.
     */
    domainByName: { api: "nivo.api.tino.get-domain-name-name", method: "GET", path: "/v1/domain/name/{name}" },
    /**
     * `get_domain_id` (docs/api/get-domain-id), scope `domains:read`: path `id`. Answer `{ success, details{ id, name, expires, status,
     * nameservers[], autorenew, reglock, contacts{...} } }` (the contacts carry personal data and are never read).
     */
    domainGet: { api: "nivo.api.tino.get-domain-id", method: "GET", path: "/v1/domain/{id}" },
    /**
     * `post_domain_lookup` (docs/api/post-domain-lookup), scope `domains:read`: body `{ name }`. Answer `{ domain, name, sld, tld,
     * premium, avaliable (spelled so), transfer, status, type, tld_id, periods[{ id, period, register, transfer, renew, ... }] }`.
     */
    domainLookup: { api: "nivo.api.tino.post-domain-lookup", method: "POST", path: "/v1/domain/lookup" },
    /**
     * `post_domain_order` (docs/api/post-domain-order), scope `domains:write`: body `{ name, years, action: "register" | "transfer",
     * tld_id, pay_method?, epp? (transfer code), nameservers? (2 to 4), registrant? admin? tech? billing? (saved contact ids), data?,
     * aff_id? }`; the page asks to look the name up first. Its answer has no published example (members unknown).
     */
    domainOrder: { api: "nivo.api.tino.post-domain-order", method: "POST", path: "/v1/domain/order" },
    /**
     * `post_domain_id_renew` (docs/api/post-domain-id-renew), scope `domains:write`: path `id`, body `{ years, pay_method? }`. Answer
     * `{ order_num, invoice_id, total, items[{ type, id, name, product_id }] }`.
     */
    domainRenew: { api: "nivo.api.tino.post-domain-id-renew", method: "POST", path: "/v1/domain/{id}/renew" },
    /**
     * `put_domain_id_ns` (docs/api/put-domain-id-ns), scope `domains:write`: path `id`, body `{ nameservers: [] }`. Answer
     * `{ success, info: ["success_changes_save"] }`.
     */
    nameserverUpdate: { api: "nivo.api.tino.put-domain-id-ns", method: "PUT", path: "/v1/domain/{id}/ns" },
    /** `get_domain_id_dns` (docs/api/get-domain-id-dns), scope `dns:read`: path `id`. No published example (members unknown). */
    dnsList: { api: "nivo.api.tino.get-domain-id-dns", method: "GET", path: "/v1/domain/{id}/dns" },
    /**
     * `post_domain_id_dns` (docs/api/post-domain-id-dns), scope `dns:write`: path `id`, body `{ name, type, priority, content }`. No
     * published example.
     */
    dnsCreate: { api: "nivo.api.tino.post-domain-id-dns", method: "POST", path: "/v1/domain/{id}/dns" },
    /**
     * `put_domain_id_dns_index` (docs/api/put-domain-id-dns-index), scope `dns:write`: path `id`, `index` (the record's place in the
     * domain's record list), body `{ record_id (the record index), name, type, priority, content }`. No published example.
     */
    dnsUpdate: { api: "nivo.api.tino.put-domain-id-dns-index", method: "PUT", path: "/v1/domain/{id}/dns/{index}" },
    /**
     * `delete_domain_id_dns_index` (docs/api/delete-domain-id-dns-index), scope `dns:write`: path `id`, `index`, query `record_id`. No
     * published example.
     */
    dnsDelete: { api: "nivo.api.tino.delete-domain-id-dns-index", method: "DELETE", path: "/v1/domain/{id}/dns/{index}" },
} as const satisfies Readonly<Record<string, TinoOperation>>

/** The name of one Tino operation constant. */
export type TinoOperationName = keyof typeof TINO_OPS
