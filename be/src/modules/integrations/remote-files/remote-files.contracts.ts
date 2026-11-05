import type { HttpPin } from "@modules/platform/http"

/** One remote file to read. The size limit, the deadline and the type check are required: a read without them does not type-check. */
export interface RemoteFileRequest {
    /** The absolute address. */
    readonly url: string
    /** Extra request headers. */
    readonly headers?: Readonly<Record<string, string>>
    /** Connects to this address instead of resolving the host name; the caller already validated it. */
    readonly pin?: HttpPin
    /** `manual` answers a redirect as it is (status and `location`) instead of following it; the default follows. */
    readonly redirect?: "follow" | "manual"
    /** The most bytes the file may hold: a larger answer is kept out. */
    readonly maxBytes: number
    /** How long to wait for the answer, in milliseconds. */
    readonly timeoutMs: number
    /** Whether the content type the answer declares (a `content-type` header value) is one the caller accepts. */
    readonly accepts: (contentType: string) => boolean
}

/** What asking the address found. `bytes` is set only for a 2xx answer of an accepted type holding between one byte and the limit. */
export interface RemoteFileAnswer {
    /** The HTTP status. */
    readonly status: number
    /** The content type the answer declared, or an empty text. */
    readonly contentType: string
    /** The `location` header of a redirect answer, when there is one. */
    readonly location: string | undefined
    /** How many bytes the answer held. */
    readonly length: number
    /** The file, or null when it was refused. */
    readonly bytes: Buffer | null
}
