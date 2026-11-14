import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * HANDWRITTEN FIXTURES of the two domain registrars, copied from their public documentation (no live call was made; no key exists):
 * Tino's are its published example answers (https://docs.tino.vn/openapi.json, the route pages under https://docs.tino.vn/docs/api/);
 * iNET publishes response SCHEMAS without example answers (https://developers.inet.vn/api-reference), so its fixtures fill each
 * published member with the example value the schema's own description gives (`vd: example.vn`, `ns1.inet.vn`), inside the published
 * wrapper (https://developers.inet.vn/docs/getting-started/response-format). Keys are obvious fakes.
 */

/** A fake API key / token: never a real credential. */
export const FAKE_KEY = "test-key"

/**
 * A registrar account. The connection kinds of the core (`Provider`) do not list `inet` / `tino` until the lead adds them, so the key is
 * typed through here, once.
 */
export const registrarAccountOf = (id: string, provider: ConnectionRecord["provider"], meta: Readonly<Record<string, string>> = {}): ConnectionRecord => ({
    id,
    workspaceId: "ws-1",
    provider,
    name: `${provider} ${id}`,
    meta,
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-01T00:00:00.000Z",
})

/** The iNET answer wrapper around `data` (response-format: `success`, `data`, `meta`). */
export const inetOk = (data: unknown): { readonly status: 200; readonly body: unknown } => ({
    status: 200,
    body: {
        success: true,
        data,
        meta: { request_id: "req-1", latency_ms: 12, endpoint: "/v1/domain", timestamp: "2026-11-13T00:00:00Z" },
    },
})

/** iNET's refusal wrapper (response-format: `{ success: false, error }`, the status says what it is). */
export const inetRefused = (status: number): { readonly status: number; readonly body: unknown } => ({
    status,
    body: { success: false, error: "API key kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c ch\u01b0a \u0111\u01b0\u1ee3c cung c\u1ea5p" },
})

/** iNET Portal `GET /domain` `data` (schema: content[], number, size, totalPages, totalElements). */
export const INET_PORTAL_DOMAIN_PAGE = {
    size: 20,
    number: 0,
    content: [
        {
            id: 123456,
            name: "example.vn",
            status: "active",
            suffix: "vn",
            contract: "approved",
            issueDate: "01/01/2026 10:00",
            expireDate: "01/01/2027",
            registrant: "Nguy\u1ec5n V\u0103n A",
            verifyStatus: "verified",
        },
    ],
    totalPages: 1,
    totalElements: 1,
}

/** iNET Portal `GET /domain/{domainId}` `data`. */
export const INET_PORTAL_DOMAIN_DETAIL = {
    id: 123456,
    name: "example.vn",
    nsList: [
        { id: 1, hostname: "ns1.inet.vn" },
        { id: 2, hostname: "ns2.inet.vn" },
    ],
    status: "active",
    suffix: "vn",
    contract: "approved",
    issueDate: "01/01/2026 10:00",
    renewDate: "01/01/2026 10:00",
    expireDate: "01/01/2027",
    registrant: "Nguy\u1ec5n V\u0103n A",
    verifyStatus: "verified",
    domainStatuses: [{ status: "ok" }],
}

/** iNET Portal `GET /domain/check-available?name=mywebsite.vn` `data`. */
export const INET_PORTAL_AVAILABLE = {
    status: ["ok"],
    available: "available",
    domainName: "mywebsite.vn",
    nameServer: [],
    availability: "available",
}

/** iNET Portal `GET /domain/{domainId}/record` `data`. */
export const INET_PORTAL_RECORDS = {
    id: 123456,
    name: "example.vn",
    recordList: [
        { id: 9001, ttl: 300, data: "1.2.3.4", name: "@", type: "A", domainId: 123456, priority: null, createdDate: "01/01/2026 10:00" },
        { id: 9002, ttl: 300, data: "example.vn", name: "www", type: "CNAME", domainId: 123456, createdDate: "01/01/2026 10:00" },
    ],
}

/** iNET reseller `GET /reseller/domains?name=example.vn` `data`: paginated `content` (item read by `id` and `name` alone). */
export const INET_RESELLER_DOMAIN_PAGE = { content: [{ id: 123456, name: "example.vn" }], number: 0, size: 20, totalPages: 1 }

/** Tino's answer of a route (HTTP 200, the body as it came). */
export const tinoOk = (body: unknown): { readonly status: 200; readonly body: unknown } => ({ status: 200, body })

/** Tino `get_domain_name_name` example answer (docs/api/get-domain-name-name). */
export const TINO_DOMAIN_BY_NAME = {
    success: true,
    domains: [
        {
            id: "200001",
            name: "example.com",
            date_created: "2025-12-07",
            firstpayment: "50000.00",
            recurring_amount: "585366.00",
            period: "1",
            expires: "2026-12-07",
            status: "Active",
            next_due: "2026-12-07",
            next_invoice: "2026-11-22",
            idprotection: "1",
            nameservers: ["ns1.tino.vn", "ns2.tino.vn"],
            autorenew: "1",
        },
    ],
    page: { current: 0, total: 1 },
}

/** Tino `get_domain` example answer (docs/api/get-domain). */
export const TINO_DOMAIN_LIST = {
    success: true,
    domains: [
        {
            id: "200001",
            name: "example.com",
            expires: "2026-12-07",
            label: "",
            recurring_amount: "585366.00",
            date_created: "2025-12-07",
            status: "Active",
            period: "1",
            idprotection: "1",
            autorenew: "1",
            daytoexpire: "127",
        },
    ],
}

/** Tino `get_domain_id` example answer (docs/api/get-domain-id), the contacts cut to their first members (personal data). */
export const TINO_DOMAIN_DETAIL = {
    success: true,
    details: {
        id: "200001",
        name: "example.com",
        reg_module: "172",
        date_created: "2025-12-07",
        firstpayment: "50000.00",
        recurring_amount: "585366.00",
        period: "1",
        expires: "2026-12-07",
        status: "Active",
        next_due: "2026-12-07",
        next_invoice: "2026-11-22",
        idprotection: "1",
        nameservers: ["ns1.tino.vn", "ns2.tino.vn"],
        autorenew: "1",
        reglock: "0",
        daytoexpire: "127",
        contacts: { registrant: { registrant: "1", type: "ind", name: "Nguyen Van A" } },
    },
}

/** Tino `post_domain_lookup` example answer (docs/api/post-domain-lookup), the documentation's own cut kept. */
export const TINO_LOOKUP = {
    domain: "example.com",
    name: "example.com",
    sld: "example",
    tld: ".com",
    description: "",
    premium: false,
    avaliable: true,
    transfer: false,
    status: "ok",
    type: "register",
    category_id: "58",
    tld_id: "346",
    periods: [
        {
            id: "346",
            period: "1",
            register: "319000.00",
            transfer: "399000.00",
            renew: "399000.00",
            redemption: "3990000.00",
            before: "399000.00",
            vatFee: 29000,
            feeRegOrigin: 290000,
        },
        {
            id: "346",
            period: "2",
            register: "638000.00",
            transfer: "798000.00",
            renew: "798000.00",
            redemption: "7980000.00",
            before: "-1.00",
            vatFee: 58000,
            feeRegOrigin: 580000,
        },
        "\u2026 8 more item(s)",
    ],
}

/** Tino `post_domain_id_renew` example answer (docs/api/post-domain-id-renew). */
export const TINO_RENEW = {
    order_num: 626303876,
    invoice_id: "1201939",
    total: "588109",
    items: [{ type: "Domain Renew", id: "200001", name: "example.com", product_id: "1435" }],
}

/** Tino `put_domain_id_ns` example answer (docs/api/put-domain-id-ns). */
export const TINO_NS_SAVED = { success: true, info: ["success_changes_save"] }

/** Tino's gateway refusal (https://docs.tino.vn/docs/api "Loi"). */
export const tinoGatewayRefused = (status: 401 | 403, code: string): { readonly status: number; readonly body: unknown } => ({
    status,
    body: { error: [code] },
})

/** A route's business refusal: HTTP 200 with an `error` array (https://docs.tino.vn/docs/api "Loi"); the code is a placeholder. */
export const TINO_ROUTE_REFUSED = { status: 200, body: { error: ["route_refusal_code"] } }
