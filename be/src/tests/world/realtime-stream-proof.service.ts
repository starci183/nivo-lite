import { TextDecoder } from "node:util"
import { parseJsonText } from "@modules/platform/primitives"

/** One typing target; two null fields select the office room. */
export interface TypingStreamTarget {
    /** The named room, when the stream follows a room. */
    readonly room: string | null
    /** The conversation, when the stream follows one. */
    readonly conversationId: string | null
}

/** A complete default-message frame received through the real HTTP event stream. */
export interface TypingStreamFrame {
    /** The server-supplied resume cursor, independently observed from the JSON payload. */
    readonly id: string | undefined
    /** The parsed payload stays unknown until a proof checks the domain contract. */
    readonly data: unknown
}

/** The authenticated caller and scoped target of one typing subscription. */
export interface TypingStreamOptions {
    /** Omitted to prove the default-deny behavior of the actual authentication guard. */
    readonly principalId?: string
    /** Workspace admission is checked against the disposable database. */
    readonly workspaceId: string
    /** Only one target is selected; two null fields select the office room. */
    readonly target: TypingStreamTarget
    /** A reconnect supplies the last frame received, through Last-Event-ID. */
    readonly after?: string
    /** A deliberate negative case: credentials in the URL must never authorize a stream. */
    readonly queryToken?: string
}

/** Observable HTTP response, complete frames and lifecycle of a real fetch client. */
export interface TypingStreamClient {
    /** The response status, including an authentication or membership refusal. */
    readonly status: number
    /** The actual response headers sent by Nest. */
    readonly headers: Headers
    /** All complete default-message frames received so far, in wire order. */
    readonly frames: ReadonlyArray<TypingStreamFrame>
    /** All decoded bytes received so far, including opening and heartbeat comments. */
    readonly raw: string
    /** True only after the response reader has terminated and released its lock. */
    readonly closed: boolean
    /** An unexpected reader or JSON failure; an explicitly requested abort is expected. */
    readonly readerError: unknown
    /** Aborts the request and waits until its reader has terminated. Safe to call repeatedly. */
    readonly disconnect: () => Promise<void>
}

/** The raw fields of one wire frame. */
interface WireFields {
    readonly id: string | undefined
    readonly event: string
    readonly data: ReadonlyArray<string>
}

/** How a response reader ended: normally, or with the failure it carried. */
type ReaderEnd = { readonly kind: "ended" } | { readonly kind: "failed"; readonly cause: unknown }

/** Splits a frame into its SSE fields, removing the single optional space after each colon. */
const fieldsOf = (text: string): WireFields => {
    const data: Array<string> = []
    let id: string | undefined
    let event = "message"
    text.split("\n").forEach((line) => {
        const colon = line.indexOf(":")
        const field = colon < 0 ? line : line.slice(0, colon)
        const remainder = colon < 0 ? "" : line.slice(colon + 1)
        const value = remainder.startsWith(" ") ? remainder.slice(1) : remainder
        if (field === "id") id = value
        if (field === "event" && value !== "") event = value
        if (field === "data") data.push(value)
    })
    return { id, event, data }
}

/** Parses a complete frame while leaving domain validation to the integration assertions. */
const defaultFrame = (text: string): TypingStreamFrame | undefined => {
    const fields = fieldsOf(text)
    if (fields.event !== "message" || fields.data.length === 0) return undefined
    const body = fields.data.join("\n")
    const parsed = parseJsonText(body)
    // Malformed JSON stays visible as its raw text, so the typed frame assertion names it instead of the reader failing.
    return { id: fields.id, data: parsed.ok ? parsed.value : body }
}

/** The authentication, workspace and resume headers of one subscription. */
const headersOf = (options: TypingStreamOptions): Record<string, string> => ({
    accept: "text/event-stream",
    "x-workspace-id": options.workspaceId,
    ...(options.principalId === undefined ? {} : { authorization: `Bearer proof-${options.principalId}` }),
    ...(options.after === undefined ? {} : { "last-event-id": options.after }),
})

/** The door URL with its target and, only for the negative case, a credential in the query string. */
const urlOf = (origin: string, options: TypingStreamOptions): URL => {
    const url = new URL("/realtime/chat-typing", origin)
    if (options.target.room !== null) url.searchParams.set("room", options.target.room)
    if (options.target.conversationId !== null) url.searchParams.set("conversationId", options.target.conversationId)
    if (options.queryToken !== undefined) url.searchParams.set("access_token", options.queryToken)
    return url
}

/** Accumulates decoded text into raw evidence and complete default-message frames. */
const collector = () => {
    const frames: Array<TypingStreamFrame> = []
    let raw = ""
    let pending = ""
    return {
        frames,
        raw: () => raw,
        append: (text: string): void => {
            raw += text
            pending = (pending + text).replace(/\r\n/g, "\n")
            let boundary = pending.indexOf("\n\n")
            while (boundary >= 0) {
                const frame = defaultFrame(pending.slice(0, boundary))
                if (frame !== undefined) frames.push(frame)
                pending = pending.slice(boundary + 2)
                boundary = pending.indexOf("\n\n")
            }
        },
    }
}

/** Reads chunk after chunk, in order, until the response ends. */
const drain = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    append: (text: string) => void,
): Promise<void> => {
    const chunk = await reader.read()
    if (chunk.done) {
        append(decoder.decode())
        return
    }
    append(decoder.decode(chunk.value, { stream: true }))
    await drain(reader, decoder, append)
}

/** Reads to the end and reports how it ended; the reader lock is always released. */
const readToEnd = async (
    reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
    append: (text: string) => void,
): Promise<ReaderEnd> => {
    if (reader === undefined) return { kind: "ended" }
    try {
        await drain(reader, new TextDecoder(), append)
        return { kind: "ended" }
    } catch (cause: unknown) {
        return { kind: "failed", cause }
    } finally {
        reader.releaseLock()
    }
}

/** Sends the request with a bounded opening deadline; a failed open aborts and rethrows. */
const openResponse = async (
    url: URL,
    headers: Record<string, string>,
    controller: AbortController,
): Promise<Response> => {
    const openingDeadline = setTimeout(() => controller.abort(), 10_000)
    try {
        return await fetch(url, { signal: controller.signal, headers })
    } catch (cause: unknown) {
        controller.abort()
        throw cause
    } finally {
        clearTimeout(openingDeadline)
    }
}

/**
 * Opens the real typing door with a deterministic proof bearer token. Reading starts immediately, so assertions can use the
 * house waitForProof helper against the collected text, frames and cleanup state without sleeping or racing a reader call.
 */
export const openTypingStream = async (origin: string, options: TypingStreamOptions): Promise<TypingStreamClient> => {
    const controller = new AbortController()
    const response = await openResponse(urlOf(origin, options), headersOf(options), controller)
    const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = response.body?.getReader()
    const collected = collector()
    let closed = false
    let readerError: unknown
    const pumping = readToEnd(reader, collected.append).then((end) => {
        if (end.kind === "failed" && !controller.signal.aborted) {
            readerError = end.cause
            controller.abort()
        }
        closed = true
    })
    return {
        status: response.status,
        headers: response.headers,
        get frames() {
            return collected.frames
        },
        get raw() {
            return collected.raw()
        },
        get closed() {
            return closed
        },
        get readerError() {
            return readerError
        },
        disconnect: async () => {
            controller.abort()
            await pumping
        },
    }
}
