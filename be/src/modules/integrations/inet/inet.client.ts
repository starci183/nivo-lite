import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { fieldNumberOf, isRecord } from "@modules/platform/primitives"
import { InetError, InetErrorCode } from "./errors/inet.error"
import type {
    InetCall,
    InetData,
    InetPortalDomain,
    InetPortalDomainPage,
    InetPortalRecord,
    InetResellerDomainRef,
} from "./inet.contracts"
import { InjectInetOptions } from "./inet.decorators"
import type { InetOperation } from "./inet.operations"
import type { InetOptions } from "./inet.options"

/** The statuses iNET's response-format page assigns a meaning (https://developers.inet.vn/docs/getting-started/response-format). */
const BAD_REQUEST = 400
const UNAUTHORIZED = 401
const FORBIDDEN = 403
const NOT_FOUND = 404
const CONFLICT = 409
const TOO_MANY_REQUESTS = 429

/** The methods that carry a JSON body (the response-format page: send `Content-Type: application/json` on POST, PUT and PATCH). */
const WITH_BODY: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH"])

/** The seconds iNET asked the caller to wait (`Retry-After`), or 0 when it named none. */
const retryAfterOf = (header: string | undefined): number => {
    const seconds = Number(header)
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0
}

/** The path of an operation with its parameters put in, each encoded. */
const pathOf = (operation: InetOperation, values: Readonly<Record<string, string>>): string =>
    operation.path.replaceAll(/\{([A-Za-z]+)\}/gu, (_whole, name: string) => {
        const value = values[name]
        if (value === undefined) throw new InetError({ code: InetErrorCode.Rejected, params: { reason: `missing path ${name}` } })
        return encodeURIComponent(value)
    })

/**
 * The request of one operation, built purely: the base and the operation's path, the query in the order given (an absent value is
 * left out), the key in `Authorization: Bearer` (https://developers.inet.vn/docs/getting-started/authentication) and the JSON body
 * of a POST / PUT / PATCH.
 */
export const inetRequestOf = (options: InetOptions, apiKey: string, operation: InetOperation, call: InetCall): HttpRequest => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(call.query ?? {})) if (value !== undefined) search.set(key, value)
    const query = search.toString()
    const suffix = query === "" ? "" : `?${query}`
    const url = `${options.apiBase}${pathOf(operation, call.path ?? {})}${suffix}`
    const headers = { Authorization: `Bearer ${apiKey}` }
    return WITH_BODY.has(operation.method)
        ? { method: operation.method, url, headers, body: call.body ?? {}, timeoutMs: options.timeoutMs }
        : { method: operation.method, url, headers, timeoutMs: options.timeoutMs }
}

/**
 * The `data` of an answer, or the typed failure by the HTTP status (the response-format page: classify by status, never by the `error`
 * text, which is for display and logs): 401 / 403 the key, 404 no such API, 409 exists, 429 slow down, 400 (and an answer saying
 * `success: false`) refused as asked, 5xx and an unreadable body not known.
 */
export const inetDataOf = (answer: HttpResponse): unknown => {
    const { status } = answer
    if (status === TOO_MANY_REQUESTS) {
        throw new InetError({
            code: InetErrorCode.RateLimited,
            params: { retryAfterSeconds: retryAfterOf(answer.headers?.["retry-after"]) },
        })
    }
    if (status === UNAUTHORIZED || status === FORBIDDEN) {
        throw new InetError({ code: InetErrorCode.AuthFailed, params: { reason: String(status) } })
    }
    if (status === NOT_FOUND) throw new InetError({ code: InetErrorCode.NotServed, params: { reason: String(status) } })
    if (status === CONFLICT) throw new InetError({ code: InetErrorCode.Conflict, params: { reason: String(status) } })
    if (status === BAD_REQUEST) throw new InetError({ code: InetErrorCode.Rejected, params: { reason: String(status) } })
    if (status < 200 || status >= 300 || !isRecord(answer.body)) {
        throw new InetError({ code: InetErrorCode.Failed, params: { reason: String(status) } })
    }
    if (answer.body.success !== true) throw new InetError({ code: InetErrorCode.Rejected, params: { reason: "success false" } })
    return answer.body.data
}

/** The answer could not be read as the documentation publishes it. */
const unreadable = (what: string): never => {
    throw new InetError({ code: InetErrorCode.Failed, params: { reason: `unreadable ${what}` } })
}

/** A member as text (a number counts), or null. */
const textOf = (value: unknown): string | null => {
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

/** A member as a number, or null. */
const numberOf = (value: unknown): number | null => fieldNumberOf(value) ?? null

/** One Portal domain (list item or detail). */
const portalDomainOf = (value: unknown): InetPortalDomain => {
    if (!isRecord(value)) return unreadable("domain")
    const id = textOf(value.id)
    const name = textOf(value.name)
    if (id === null || name === null) return unreadable("domain")
    const nameservers = Array.isArray(value.nsList)
        ? value.nsList.flatMap((ns: unknown) => {
              const host = isRecord(ns) ? textOf(ns.hostname) : null
              return host === null ? [] : [host]
          })
        : null
    return { id, name, status: textOf(value.status), expireDate: textOf(value.expireDate), nameservers }
}

/** The Portal domain list's `data` (`content`, `totalPages`). */
export const portalDomainPageOf = (data: unknown): InetPortalDomainPage => {
    if (!isRecord(data) || !Array.isArray(data.content)) return unreadable("domain page")
    return { content: data.content.map((row: unknown) => portalDomainOf(row)), totalPages: numberOf(data.totalPages) }
}

/** The Portal domain detail's `data`. */
export const portalDomainDetailOf = (data: unknown): InetPortalDomain => portalDomainOf(data)

/** The availability answer of the Portal. */
export interface InetAvailability {
    /** The domain name the answer is about. */
    readonly name: string
    /** Whether the name is free to register. */
    readonly available: boolean
}

/** The Portal availability's `data`: `available` is `available` or `unavailable` (the published enum), `domainName` the name. */
export const portalAvailabilityOf = (data: unknown, asked: string): InetAvailability => {
    if (!isRecord(data) || (data.available !== "available" && data.available !== "unavailable")) return unreadable("availability")
    return { name: textOf(data.domainName) ?? asked, available: data.available === "available" }
}

/** The Portal record list's (and record update's) `data.recordList`. */
export const portalRecordsOf = (data: unknown): ReadonlyArray<InetPortalRecord> => {
    if (!isRecord(data) || !Array.isArray(data.recordList)) return unreadable("records")
    return data.recordList.map((row: unknown): InetPortalRecord => {
        if (!isRecord(row)) return unreadable("record")
        const name = textOf(row.name)
        const type = textOf(row.type)
        const value = textOf(row.data)
        if (name === null || type === null || value === null) return unreadable("record")
        return { id: textOf(row.id), name, type, data: value, ttl: numberOf(row.ttl), priority: numberOf(row.priority) }
    })
}

/** The reseller domain list's `data.content`, read by `id` and `name` alone (see `INET_OPS.resellerDomainList`). */
export const resellerDomainRefsOf = (data: unknown): ReadonlyArray<InetResellerDomainRef> => {
    if (!isRecord(data) || !Array.isArray(data.content)) return unreadable("reseller domain page")
    return data.content.map((row: unknown): InetResellerDomainRef => {
        const id = isRecord(row) ? textOf(row.id) : null
        const name = isRecord(row) ? textOf(row.name) : null
        return id === null || name === null ? unreadable("reseller domain") : { id, name }
    })
}

/** An answer kept as it came, for a person to read (an object; any other JSON value is wrapped under `value`). */
export const inetDataAsIs = (data: unknown): InetData => (isRecord(data) ? data : { value: data })

@Injectable()
/** The one place that talks to iNET's API. The API key is always explicit (the key of one connection) and never logged. */
export class InetClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectInetOptions() private readonly options: InetOptions,
    ) {}

    /** Runs one operation and answers its `data`; a refusal or a failure is an `InetError` saying where it failed. */
    async call(apiKey: string, operation: InetOperation, call: InetCall): Promise<unknown> {
        const request = inetRequestOf(this.options, apiKey, operation, call)
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new InetError({ code: InetErrorCode.Unreachable, cause })
        })
        return inetDataOf(answer)
    }
}
