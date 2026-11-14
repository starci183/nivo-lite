import type { HttpMethod } from "./inet.contracts"

/**
 * THE iNET OPERATIONS NIVO CALLS, each from iNET's public developer documentation (read 2026-11-13, no live call made):
 * - the reference of every endpoint (method, path, request members, and the response schema where one is published):
 *   https://developers.inet.vn/api-reference
 * - the wrapper of every answer (`success`, `data`, `error`, `meta`), the HTTP statuses and pagination (`data.content`):
 *   https://developers.inet.vn/docs/getting-started/response-format
 * - auth: header `Authorization: Bearer inet_sk_...` (one API key, created at developers.inet.vn; a key's CONTEXT is chosen when it is
 *   created: personal, or "Dai ly (RESELLER)" for the `/reseller/*` endpoints):
 *   https://developers.inet.vn/docs/getting-started/authentication and https://developers.inet.vn/docs/getting-started/reseller-connect
 * Base: `https://developers.inet.vn/api/gateway/v1`. No sandbox: a write on the reseller API debits the reseller balance (reseller-connect).
 *
 * The NAME of each operation is `nivo.api.inet.<method>-<path in kebab case>` (iNET publishes no operation ids, so the name is its
 * method and path, the way Tino's ids read); the path's `{param}` is kept as its kebab word.
 */
export interface InetOperation {
    /** The operation's NIVO name. */
    readonly api: `nivo.api.inet.${string}`
    /** The HTTP method. */
    readonly method: HttpMethod
    /** The path below the base, `{param}` for a path parameter. */
    readonly path: string
    /** Which key context the documentation files it under: `portal` (a customer's own key) or `reseller` (a reseller-context key). */
    readonly family: InetFamily
}

/** The two key contexts of iNET's API (a key is made for one). */
export type InetFamily = "portal" | "reseller"

/** The operations, by a stable name (the adapter writes `INET_OPS.portalDomainList`, never the path). */
export const INET_OPS = {
    /**
     * Portal "Danh sach ten mien": query `name`, `status`, `page` (from 1), `pageSize`. Response `data`: `content[]` of `{ id, name,
     * status, suffix, contract, issueDate, expireDate, registrant, verifyStatus }`, `number` (0-based), `size`, `totalPages`, `totalElements`.
     */
    portalDomainList: { api: "nivo.api.inet.get-domain", method: "GET", path: "/domain", family: "portal" },
    /**
     * Portal "Chi tiet ten mien": path `domainId`. Response `data`: `{ id, name, nsList[{ id, hostname }], status, suffix, contract,
     * issueDate, renewDate, expireDate, registrant, verifyStatus, domainStatuses[{ status }] }`.
     */
    portalDomainGet: { api: "nivo.api.inet.get-domain-domain-id", method: "GET", path: "/domain/{domainId}", family: "portal" },
    /**
     * Portal "Kiem tra ten mien kha dung": query `name` (required). Response `data`: `{ status[], available: "available" | "unavailable",
     * domainName, nameServer[], availability }`.
     */
    portalAvailability: {
        api: "nivo.api.inet.get-domain-check-available",
        method: "GET",
        path: "/domain/check-available",
        family: "portal",
    },
    /**
     * Portal "Cap nhat Nameserver": path `domainId`, body `{ nsList: [{ hostname }] }` (required). Response `data`: `{ id, name,
     * nsList[{ id, domainId, hostname, domainName }], status, suffix, modifiedDate, domainStatuses[] }`.
     */
    portalNameserverUpdate: {
        api: "nivo.api.inet.patch-domain-domain-id-nameserver",
        method: "PATCH",
        path: "/domain/{domainId}/nameserver",
        family: "portal",
    },
    /**
     * Portal "Danh sach ban ghi ten mien" (domain on ns1/ns2.inet.vn): path `domainId`. Response `data`: `{ id, name, recordList[{ id,
     * ttl, data, name, type, domainId, priority, createdDate }] }`.
     */
    portalRecordList: {
        api: "nivo.api.inet.get-domain-domain-id-record",
        method: "GET",
        path: "/domain/{domainId}/record",
        family: "portal",
    },
    /**
     * Portal "Cap nhat DNS records": path `domainId`, body `{ recordList: [{ id?, ttl? (string, seconds), data, name, type, action:
     * "ACTION_ADD" | "ACTION_DELETE", domainId }] }`; an update is documented as two items, ACTION_DELETE of the old + ACTION_ADD of the
     * new. Response `data`: `{ id, name, status, recordList[{ id, ttl, data, name, type, priority, createdDate }] }`.
     */
    portalRecordUpdate: {
        api: "nivo.api.inet.patch-domain-domain-id-record",
        method: "PATCH",
        path: "/domain/{domainId}/record",
        family: "portal",
    },
    /**
     * Reseller "Danh sach ten mien": query `page` (from 1), `pageSize`, `name`, and more filters. The ITEM schema is not published; the
     * answer is paginated in `data.content` (response-format) and the adapter reads only `id` and `name` of an item, the members the
     * reseller Domain API's own published schema (`GET /reseller/domains/{id}/auth-code`) names a domain by.
     */
    resellerDomainList: { api: "nivo.api.inet.get-reseller-domains", method: "GET", path: "/reseller/domains", family: "reseller" },
    /**
     * Reseller "Kiem tra ten mien dang ky duoc khong": query `name`. The statuses are documented (`available`, `notavailable`) but NOT
     * the member that carries them: docs-missing for the answer, so the adapter does not call it (`not_available`).
     */
    resellerAvailability: {
        api: "nivo.api.inet.get-reseller-domains-availability",
        method: "GET",
        path: "/reseller/domains/availability",
        family: "reseller",
    },
    /**
     * Reseller "Dang ky ten mien": body `{ name, period (years), customerId, nsList[{ hostname }] (2 to 12), contacts[{ type
     * (registrant | admin | technique | billing), fullname, organization, email, phone, fax, country, province, address, ward,
     * taxCode, gender, idNumber, birthday }] }` (all five required). Response: "the domain object" (members not published).
     */
    resellerRegister: { api: "nivo.api.inet.post-reseller-domains", method: "POST", path: "/reseller/domains", family: "reseller" },
    /** Reseller "Gia han ten mien": path `id`, body `{ period }` (required). Response members not published. */
    resellerRenew: {
        api: "nivo.api.inet.post-reseller-domains-id-renew",
        method: "POST",
        path: "/reseller/domains/{id}/renew",
        family: "reseller",
    },
    /** Reseller "Doi name server": path `id`, body `{ nsList: [{ hostname }] }` (2 to 12). Response members not published. */
    resellerNameserverUpdate: {
        api: "nivo.api.inet.put-reseller-domains-id-nameservers",
        method: "PUT",
        path: "/reseller/domains/{id}/nameservers",
        family: "reseller",
    },
    /** Reseller "Danh sach ban ghi DNS": path `id`. Response members not published (the list rides as it came). */
    resellerRecordList: {
        api: "nivo.api.inet.get-reseller-domains-id-records",
        method: "GET",
        path: "/reseller/domains/{id}/records",
        family: "reseller",
    },
    /**
     * Reseller "Them/xoa ban ghi DNS": path `id`, body `{ recordList: [{ action: "add" | "del", type, name, data, id (for del) }] }`.
     * Response members not published.
     */
    resellerRecordUpdate: {
        api: "nivo.api.inet.patch-reseller-domains-id-records",
        method: "PATCH",
        path: "/reseller/domains/{id}/records",
        family: "reseller",
    },
    /**
     * Reseller "Yeu cau chuyen ten mien ve": body `{ name, authCode, customerId }` (all required). Response members not published.
     */
    resellerTransferIn: {
        api: "nivo.api.inet.post-reseller-domain-transfers",
        method: "POST",
        path: "/reseller/domain-transfers",
        family: "reseller",
    },
} as const satisfies Readonly<Record<string, InetOperation>>

/** The name of one iNET operation constant. */
export type InetOperationName = keyof typeof INET_OPS
