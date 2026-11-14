import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import type { LookupFunction } from "node:net"
import { HttpError, HttpErrorCode } from "./errors/http.error"
import type { HttpPin } from "./http.port"

/** What a pinned request answered, before the body is read as the caller asked. */
export interface PinnedAnswer {
    /** The HTTP status code. */
    readonly status: number
    /** The response headers, names in lower case. */
    readonly headers: Readonly<Record<string, string>>
    /** The raw body; empty when `tooLarge`. */
    readonly body: Buffer
    /** Set only when the request named its own `maxBytes` and the body passed it: the read stopped there and kept nothing. */
    readonly tooLarge?: true
}

/** What a pinned request sends. */
export interface PinnedInit {
    /** The HTTP method. */
    readonly method: string
    /** The request headers. */
    readonly headers: Readonly<Record<string, string>>
    /** The body, when there is one. */
    readonly body: string | Buffer | undefined
    /** How long to wait before the call fails as a timeout. */
    readonly timeoutMs: number
    /** Cancels the call when aborted. */
    readonly signal?: AbortSignal
    /**
     * The most body bytes the caller wants to hold: a body that passes it (or that declares more) stops the read at once and the answer
     * says `tooLarge`, nothing kept. Absent: the default cap, and a body over it fails the call.
     */
    readonly maxBytes?: number
}

/** The most bytes a pinned answer may carry before the call is cut when the caller names no limit. */
const BODY_CAP = 25_000_000

/** A lookup that answers only the pinned address, so the connection cannot be sent anywhere the caller did not check. */
const pinnedLookup =
    (pin: HttpPin): LookupFunction =>
    (_hostname, options, callback) => {
        if (options.all === true) callback(null, [{ address: pin.address, family: pin.family }])
        else callback(null, pin.address, pin.family)
    }

/**
 * Sends one request to the pinned address: the URL keeps its host name, so the Host header and the TLS server name (SNI and certificate
 * check) stay the original, while the socket is opened to the address the caller already validated. Redirects are never followed.
 */
export const sendPinned = (url: URL, pin: HttpPin, init: PinnedInit): Promise<PinnedAnswer> =>
    new Promise<PinnedAnswer>((resolve, reject) => {
        const open = url.protocol === "https:" ? httpsRequest : httpRequest
        const fail = (cause: unknown, timedOut: boolean): void =>
            reject(new HttpError({ code: timedOut ? HttpErrorCode.Timeout : HttpErrorCode.Network, cause }))
        const req = open(
            url,
            {
                method: init.method,
                headers: init.headers,
                lookup: pinnedLookup(pin),
                timeout: init.timeoutMs,
                ...(init.signal === undefined ? {} : { signal: init.signal }),
            },
            (res) => {
                const status = res.statusCode ?? 0
                const headers = Object.fromEntries(
                    Object.entries(res.headers).map(([name, value]) => [
                        name,
                        Array.isArray(value) ? value.join(", ") : (value ?? ""),
                    ]),
                )
                const own = init.maxBytes
                const cap = own ?? BODY_CAP
                const cutOver = (): void => {
                    resolve({ status, headers, body: Buffer.alloc(0), tooLarge: true })
                    res.destroy()
                }
                if (own !== undefined && Number(headers["content-length"] ?? 0) > cap) {
                    cutOver()
                    return
                }
                const chunks: Array<Buffer> = []
                let size = 0
                let cut = false
                res.on("data", (chunk: Buffer) => {
                    if (cut) return
                    size += chunk.length
                    if (size <= cap) {
                        chunks.push(chunk)
                    } else if (own === undefined) {
                        req.destroy(new Error("body too large"))
                    } else {
                        cut = true
                        chunks.length = 0
                        cutOver()
                    }
                })
                res.on("error", (cause) => fail(cause, false))
                res.on("end", () => resolve({ status, headers, body: Buffer.concat(chunks) }))
            },
        )
        req.on("timeout", () => req.destroy(new Error("timeout")))
        req.on("error", (cause) => fail(cause, cause.message === "timeout"))
        if (init.body !== undefined) req.write(init.body)
        req.end()
    })
