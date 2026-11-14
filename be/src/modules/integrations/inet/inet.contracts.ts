import type { HttpRequest } from "@modules/platform/http"

/** The HTTP methods the iNET operations use. */
export type HttpMethod = HttpRequest["method"]

/** A JSON value iNET answered, kept as it came. */
export interface InetData {
    /** Any member. */
    readonly [member: string]: unknown
}

/** What one call of an operation sends besides the key: the path parameters, the query and the JSON body. */
export interface InetCall {
    /** The values of the path's `{param}`s. */
    readonly path?: Readonly<Record<string, string>>
    /** The query parameters (an absent value is not sent). */
    readonly query?: Readonly<Record<string, string | undefined>>
    /** The JSON body of a POST / PUT / PATCH. */
    readonly body?: InetData
}

/** One domain as the Portal domain API publishes it (the members the adapter reads). */
export interface InetPortalDomain {
    /** `id`. */
    readonly id: string
    /** `name`. */
    readonly name: string
    /** `status` (active, expired, trial, suspended), or null. */
    readonly status: string | null
    /** `expireDate` as printed, or null. */
    readonly expireDate: string | null
    /** `nsList[].hostname`, or null when the answer has no `nsList` (the list endpoint). */
    readonly nameservers: ReadonlyArray<string> | null
}

/** A page of the Portal domain list. */
export interface InetPortalDomainPage {
    /** `content`. */
    readonly content: ReadonlyArray<InetPortalDomain>
    /** `totalPages`, or null. */
    readonly totalPages: number | null
}

/** One DNS record as the Portal record API publishes it. */
export interface InetPortalRecord {
    /** `id`, as text. */
    readonly id: string | null
    /** `name`. */
    readonly name: string
    /** `type`. */
    readonly type: string
    /** `data`. */
    readonly data: string
    /** `ttl`, or null. */
    readonly ttl: number | null
    /** `priority`, or null. */
    readonly priority: number | null
}

/** One reseller list item, by the two members the reseller Domain API names a domain by (`id`, `name`). */
export interface InetResellerDomainRef {
    /** `id`. */
    readonly id: string
    /** `name`. */
    readonly name: string
}
