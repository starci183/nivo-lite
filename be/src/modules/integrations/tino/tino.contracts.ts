import type { HttpRequest } from "@modules/platform/http"

/** The HTTP methods the Tino operations use. */
export type HttpMethod = HttpRequest["method"]

/** A JSON value Tino answered, kept as it came. */
export interface TinoData {
    /** Any member. */
    readonly [member: string]: unknown
}

/** What one call of an operation sends besides the token: the path parameters, the query and the JSON body. */
export interface TinoCall {
    /** The values of the path's `{param}`s. */
    readonly path?: Readonly<Record<string, string>>
    /** The query parameters (an absent value is not sent). */
    readonly query?: Readonly<Record<string, string | undefined>>
    /** The JSON body of a POST / PUT. */
    readonly body?: TinoData
}

/** One domain as Tino's list, by-name and detail routes publish it (the members the adapter reads). */
export interface TinoDomain {
    /** `id`. */
    readonly id: string
    /** `name`. */
    readonly name: string
    /** `status` (`Active`, ...), or null. */
    readonly status: string | null
    /** `expires` (`YYYY-MM-DD`), or null. */
    readonly expires: string | null
    /** `nameservers`, or null when the route's answer has none (the list). */
    readonly nameservers: ReadonlyArray<string> | null
    /** `autorenew` (`"1"` / `"0"`), or null. */
    readonly autoRenew: boolean | null
}

/** One period's prices of a lookup (`periods[]`). */
export interface TinoPeriod {
    /** `period` (years). */
    readonly years: number
    /** `register`, or null. */
    readonly register: number | null
    /** `renew`, or null. */
    readonly renew: number | null
    /** `transfer`, or null. */
    readonly transfer: number | null
}

/** A lookup's answer. */
export interface TinoLookup {
    /** `name` (else `domain`). */
    readonly name: string
    /** `avaliable` (Tino's spelling). */
    readonly available: boolean
    /** `tld_id`, or null: what an order takes. */
    readonly tldId: string | null
    /** `periods`. */
    readonly periods: ReadonlyArray<TinoPeriod>
}

/** A renewal's answer. */
export interface TinoRenewal {
    /** `invoice_id`, else `order_num`, or null. */
    readonly reference: string | null
    /** `total`, or null. */
    readonly total: number | null
}
