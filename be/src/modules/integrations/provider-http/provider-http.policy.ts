import { randomUUID } from "node:crypto"

/**
 * The GENERIC reading of a provider's HTTP answer, the same for every hand-built provider client: the class of a status (by its number
 * alone, never by the provider's words), the seconds a 429 asked to wait, and a `multipart/form-data` body for a provider whose
 * documented request takes one. Each client maps the class to its own typed error and reads its own documented members.
 */

/**
 * The class of an answered status: `ok` (2xx), `auth` (401, 403: the credential), `rate_limited` (429), `not_found` (404), `rejected`
 * (any other 4xx: the provider refused the request and did nothing), `server` (5xx or anything else: it may have acted).
 */
export type StatusClass = "ok" | "auth" | "rate_limited" | "not_found" | "rejected" | "server"

const UNAUTHORIZED = 401
const FORBIDDEN = 403
const NOT_FOUND = 404
const TOO_MANY = 429

/** The class of a status. */
export const statusClassOf = (status: number): StatusClass => {
    if (status >= 200 && status < 300) return "ok"
    if (status === UNAUTHORIZED || status === FORBIDDEN) return "auth"
    if (status === TOO_MANY) return "rate_limited"
    if (status === NOT_FOUND) return "not_found"
    if (status >= 400 && status < 500) return "rejected"
    return "server"
}

/** The seconds an answer asked the caller to wait (`Retry-After` as seconds), or 0 when it named none. */
export const retryAfterSecondsOf = (headers: Readonly<Record<string, string>> | undefined): number => {
    const seconds = Number(headers?.["retry-after"])
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0
}

/** The longest provider text a typed error carries. */
const DETAIL_MAX = 300

/** A provider's text cut to what a typed error carries, or null for none. */
export const cutDetail = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, DETAIL_MAX) : null

/** One text field of a multipart body. */
export interface MultipartField {
    /** The field name the provider documents. */
    readonly name: string
    /** Its value. */
    readonly value: string
}

/** A `multipart/form-data` body: the bytes and the content type that names its boundary. */
export interface MultipartBody {
    /** The bytes. */
    readonly bytes: Buffer
    /** The `content-type` header value. */
    readonly contentType: string
}

/**
 * A `multipart/form-data` body of text fields (RFC 7578): one part per field, in order. The boundary is random, so no value can close a
 * part early; a value carrying a line break is sent as it is (the part's length is its bytes).
 */
export const multipartOf = (fields: ReadonlyArray<MultipartField>, boundary: string = `nivo-${randomUUID()}`): MultipartBody => {
    const parts = fields.map(
        (field) => `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
    )
    return {
        bytes: Buffer.from(`${parts.join("")}--${boundary}--\r\n`, "utf8"),
        contentType: `multipart/form-data; boundary=${boundary}`,
    }
}

/**
 * One documented operation of a provider, as its integration's operation table states it: the level-1 name it is known by
 * (`nivo.api.<provider segment>.<operation>`), its HTTP method and path (null when the documentation could not be read), the official
 * documentation it was built from, whether it is built or its documentation is missing, and the generic purpose (`nivo.tool.*`) it
 * serves, or null.
 */
export interface ProviderOperation {
    /** The level-1 name. */
    readonly api: string
    /** The HTTP method, or null when the documentation is missing. */
    readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | null
    /** The path under the API's origin, or null when the documentation is missing. */
    readonly path: string | null
    /** The official documentation URL (or, when missing, what was searched). */
    readonly docs: string
    /** `built` from the documentation, or `docs-missing` (its adapter method refuses `not_available`). */
    readonly status: "built" | "docs-missing"
    /** The generic purpose it serves, or null. */
    readonly serves: string | null
}
