import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { fieldNumberOf, isRecord } from "@modules/platform/primitives"
import { TinoError, TinoErrorCode } from "./errors/tino.error"
import type { TinoCall, TinoData, TinoDomain, TinoLookup, TinoPeriod, TinoRenewal } from "./tino.contracts"
import { InjectTinoOptions } from "./tino.decorators"
import type { TinoOperation } from "./tino.operations"
import type { TinoOptions } from "./tino.options"

/** The statuses of Tino's gateway refusals (https://docs.tino.vn/docs/api, "Loi"). */
const UNAUTHORIZED = 401
const FORBIDDEN = 403

/** The methods that carry a JSON body (https://docs.tino.vn/docs/api, "Gui tham so": POST, PUT take a JSON body). */
const WITH_BODY: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH"])

/** The first code of an `error` (or `info`) array, or null. */
const firstCodeOf = (value: unknown): string | null =>
    Array.isArray(value) && typeof value[0] === "string" && value[0] !== "" ? value[0] : null

/** The path of an operation with its parameters put in, each encoded. */
const pathOf = (operation: TinoOperation, values: Readonly<Record<string, string>>): string =>
    operation.path.replaceAll(/\{([A-Za-z]+)\}/gu, (_whole, name: string) => {
        const value = values[name]
        if (value === undefined) throw new TinoError({ code: TinoErrorCode.Rejected, params: { reason: `missing path ${name}` } })
        return encodeURIComponent(value)
    })

/**
 * The request of one operation, built purely: the base and the route, the query in the order given (GET / DELETE take their members
 * in the query string), the token in `Authorization: Bearer`, the JSON body of a POST / PUT (https://docs.tino.vn/docs/api).
 */
export const tinoRequestOf = (options: TinoOptions, token: string, operation: TinoOperation, call: TinoCall): HttpRequest => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(call.query ?? {})) if (value !== undefined) search.set(key, value)
    const query = search.toString()
    const suffix = query === "" ? "" : `?${query}`
    const url = `${options.apiBase}${pathOf(operation, call.path ?? {})}${suffix}`
    const headers = { Authorization: `Bearer ${token}` }
    return WITH_BODY.has(operation.method)
        ? { method: operation.method, url, headers, body: call.body ?? {}, timeoutMs: options.timeoutMs }
        : { method: operation.method, url, headers, timeoutMs: options.timeoutMs }
}

/**
 * The body of an answer, or the typed failure: 401 / 403 the gateway refused the token; a 2xx whose body carries an `error` array is the
 * route's business refusal (Tino answers those with HTTP 200), its first code handed on; any other status, or a body that is no JSON
 * object, is a failure whose effect is not known.
 */
export const tinoBodyOf = (answer: HttpResponse): TinoData => {
    const { status } = answer
    if (status === UNAUTHORIZED || status === FORBIDDEN) {
        const code = isRecord(answer.body) ? firstCodeOf(answer.body.error) : null
        throw new TinoError({ code: TinoErrorCode.AuthFailed, params: { reason: code ?? String(status) } })
    }
    if (status < 200 || status >= 300 || !isRecord(answer.body)) {
        throw new TinoError({ code: TinoErrorCode.Failed, params: { reason: String(status) } })
    }
    const refused = firstCodeOf(answer.body.error)
    if (refused !== null) throw new TinoError({ code: TinoErrorCode.Rejected, params: { reason: refused } })
    return answer.body
}

/** The answer could not be read as the documentation publishes it. */
const unreadable = (what: string): never => {
    throw new TinoError({ code: TinoErrorCode.Failed, params: { reason: `unreadable ${what}` } })
}

/** A member as text (a number counts), or null. */
const textOf = (value: unknown): string | null => {
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

/** A member as a number (a numeric string counts), or null. */
const numberOf = (value: unknown): number | null => fieldNumberOf(value) ?? null

/** Tino's flags print `"1"` / `"0"`. */
const flagOf = (value: unknown): boolean | null => {
    const text = textOf(value)
    if (text === "1") return true
    return text === "0" ? false : null
}

/** One domain row (list, by-name or detail). */
const domainOf = (value: unknown): TinoDomain => {
    if (!isRecord(value)) return unreadable("domain")
    const id = textOf(value.id)
    const name = textOf(value.name)
    if (id === null || name === null) return unreadable("domain")
    const nameservers = Array.isArray(value.nameservers)
        ? value.nameservers.flatMap((ns: unknown) => {
              const host = textOf(ns)
              return host === null ? [] : [host]
          })
        : null
    return {
        id,
        name,
        status: textOf(value.status),
        expires: textOf(value.expires),
        nameservers,
        autoRenew: flagOf(value.autorenew),
    }
}

/** The `domains` of the list or by-name answer. */
export const tinoDomainsOf = (body: TinoData): ReadonlyArray<TinoDomain> => {
    if (!Array.isArray(body.domains)) return unreadable("domains")
    return body.domains.map((row: unknown) => domainOf(row))
}

/** The `details` of the detail answer. */
export const tinoDomainDetailOf = (body: TinoData): TinoDomain => domainOf(body.details)

/** One `periods[]` row of a lookup; a row cut by the documentation's example (a string) is no period. */
const periodOf = (value: unknown): Array<TinoPeriod> => {
    if (!isRecord(value)) return []
    const years = numberOf(value.period)
    if (years === null) return []
    return [{ years, register: numberOf(value.register), renew: numberOf(value.renew), transfer: numberOf(value.transfer) }]
}

/** The lookup's answer: `avaliable` (Tino's spelling) is a boolean; `tld_id` is what an order takes. */
export const tinoLookupOf = (body: TinoData, asked: string): TinoLookup => {
    if (typeof body.avaliable !== "boolean") return unreadable("lookup")
    return {
        name: textOf(body.name) ?? textOf(body.domain) ?? asked,
        available: body.avaliable,
        tldId: textOf(body.tld_id),
        periods: Array.isArray(body.periods) ? body.periods.flatMap((row: unknown) => periodOf(row)) : [],
    }
}

/** The renewal's answer: the invoice (else the order number) and the total. */
export const tinoRenewalOf = (body: TinoData): TinoRenewal => ({
    reference: textOf(body.invoice_id) ?? textOf(body.order_num),
    total: numberOf(body.total),
})

@Injectable()
/** The one place that talks to Tino's API. The token is always explicit (the token of one connection) and never logged. */
export class TinoClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectTinoOptions() private readonly options: TinoOptions,
    ) {}

    /** Runs one operation and answers its body; a refusal or a failure is a `TinoError` saying where it failed. */
    async call(token: string, operation: TinoOperation, call: TinoCall): Promise<TinoData> {
        const request = tinoRequestOf(this.options, token, operation, call)
        const answer = await this.http.request(request).catch((cause: unknown) => {
            throw new TinoError({ code: TinoErrorCode.Unreachable, cause })
        })
        return tinoBodyOf(answer)
    }
}
