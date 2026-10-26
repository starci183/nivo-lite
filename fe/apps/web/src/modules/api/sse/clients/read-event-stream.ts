import { renewSessionToken, sessionAccessToken } from "@/modules/auth"

/** One event the stream delivered: its id (the resume point the next request names in `Last-Event-ID`) and its data text. */
export interface ServerSentEvent {
    readonly id: string | undefined
    readonly data: string
}

/** Where a stream reports one failed attempt, as one line (the app's observability, when it wires one). */
export type StreamReporter = (line: string) => void

/** What following a stream takes. */
export interface FollowEventStreamParams {
    /** The absolute URL of the stream (`eventStreamUrl`). */
    readonly url: string
    /** Extra request headers (for example `X-Workspace-Id`); `Authorization`, `Accept` and `Last-Event-ID` are set by the client and win. */
    readonly headers?: Readonly<Record<string, string>>
    /** Stops the stream and its reconnects. */
    readonly signal: AbortSignal
    /** Called each time the stream (re)opens: the moment to read a snapshot, which closes the gap since the last event. */
    readonly onOpen: () => void
    /** Called once per event, in order. */
    readonly onEvent: (event: ServerSentEvent) => void
    /** Where a refused or broken attempt is reported; absent, it stays silent. */
    readonly report?: StreamReporter
}

/** The wait between two attempts doubles from the first delay (the server's `retry` replaces it) up to the longest. */
const RECONNECT_POLICY = { initialDelayMs: 1_000, maxDelayMs: 15_000 } as const

/** The server heartbeats every 15 to 25 seconds while idle; a connection silent for longer than this is dead and is reopened. */
const HEARTBEAT_TIMEOUT_MS = 45_000

/** The lines of the event-stream format: a blank line ends an event, `:` starts a comment, `field: value` sets a field. */
const LINE_BREAK = /\r\n|\n|\r/

/** A refusal that repeats: the server answered a 4xx other than 408 (timeout) and 429 (too many requests), so asking again cannot help. */
class StreamRefusedError extends Error {}

/** True when a status is a refusal the server repeats. */
const isFinalRefusal = (status: number): boolean => status >= 400 && status < 500 && status !== 408 && status !== 429

/** A random fraction in [0, 1): spreads the reconnects of many clients that lost the same server. */
const randomFraction = (): number => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / 2 ** 32

/** Turns the text of ONE response, chunk by chunk, into events: `onEvent` once per complete event of the default message type (the stream names no event), `onRetry` for every `retry` field. An unfinished event dies with its response. */
const createEventParser = (onEvent: (event: ServerSentEvent) => void, onRetry: (delayMs: number) => void) => {
    let pending = ""
    let id: string | undefined
    let data: Array<string> = []
    const readLine = (line: string): void => {
        if (line === "") {
            if (data.length > 0) onEvent({ id, data: data.join("\n") })
            data = []
            return
        }
        if (line.startsWith(":")) return
        const colon = line.indexOf(":")
        const field = colon === -1 ? line : line.slice(0, colon)
        const raw = colon === -1 ? "" : line.slice(colon + 1)
        const value = raw.startsWith(" ") ? raw.slice(1) : raw
        if (field === "data") data.push(value)
        if (field === "id" && !value.includes("\0")) id = value
        if (field === "retry" && /^\d+$/.test(value)) onRetry(Number(value))
    }
    return (chunk: string): void => {
        const lines = (pending + chunk).split(LINE_BREAK)
        pending = lines.pop() ?? ""
        lines.forEach(readLine)
    }
}

/** Waits `delayMs`, or less when the signal aborts; a signal that already aborted waits for nothing. */
const pause = (delayMs: number, signal: AbortSignal): Promise<void> =>
    new Promise((resolve) => {
        if (signal.aborted) {
            resolve()
            return
        }
        const finish = (): void => {
            clearTimeout(timer)
            signal.removeEventListener("abort", finish)
            resolve()
        }
        const timer = setTimeout(finish, delayMs)
        signal.addEventListener("abort", finish, { once: true })
    })

/** Requests the stream with the session bearer token; one 401 renews the token and asks again. */
const request = async (
    url: string,
    headers: Readonly<Record<string, string>>,
    lastEventId: string | undefined,
    signal: AbortSignal,
): Promise<Response> => {
    const send = (token: string | undefined): Promise<Response> =>
        fetch(url, {
            signal,
            cache: "no-store",
            headers: {
                ...headers,
                accept: "text/event-stream",
                ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
                ...(lastEventId === undefined ? {} : { "last-event-id": lastEventId }),
            },
        })
    let response = await send(await sessionAccessToken())
    if (response.status === 401) response = await send(await renewSessionToken())
    if (response.ok && response.body !== null) return response
    const message = `the event stream was refused with status ${response.status}`
    throw isFinalRefusal(response.status) ? new StreamRefusedError(message) : new Error(message)
}

/**
 * Reads the decoded text of a response until it ends, handing each chunk to the parser. The canon forbids an `await` in a loop, so
 * the read recurses: one promise per chunk is held until the response ends, a bounded cost (a response ends at the next reconnect).
 */
const drain = async (
    reader: ReadableStreamDefaultReader<string>,
    parse: (chunk: string) => void,
    onChunk: () => void,
): Promise<void> => {
    const chunk = await reader.read()
    if (chunk.done) return
    onChunk()
    parse(chunk.value)
    return drain(reader, parse, onChunk)
}

/**
 * Follows a server-sent event stream of the back end api until the signal aborts. It is `fetch`-based because the browser
 * `EventSource` cannot send `Authorization`: the session bearer token (renewed once on a 401) and the caller's headers (for example
 * `X-Workspace-Id`) go on every attempt. Each time it opens it calls `onOpen` (the snapshot revalidation). When the connection
 * ends, fails or stays silent beyond the heartbeat timeout, it waits (doubling, capped, with full jitter; the server's `retry`
 * replaces the first delay) and reopens with the last id as `Last-Event-ID`, so the back end replays what was missed. Every
 * response has its own parser, so a fragment of a broken connection never joins the next one. A refusal that repeats (a 4xx other
 * than 408 and 429) is reported once and ends the stream, as the browser `EventSource` does.
 */
export const followEventStream = async ({
    url,
    headers = {},
    signal,
    onOpen,
    onEvent,
    report,
}: FollowEventStreamParams): Promise<void> => {
    let lastEventId: string | undefined
    let retryMs: number = RECONNECT_POLICY.initialDelayMs
    let delayMs: number = retryMs
    const attempt = async (): Promise<void> => {
        if (signal.aborted) return
        const connection = new AbortController()
        const stop = (): void => connection.abort()
        signal.addEventListener("abort", stop, { once: true })
        let silenceTimer: ReturnType<typeof setTimeout> | undefined
        const watchSilence = (): void => {
            clearTimeout(silenceTimer)
            silenceTimer = setTimeout(
                () => connection.abort(new Error("the event stream went silent")),
                HEARTBEAT_TIMEOUT_MS,
            )
        }
        try {
            watchSilence()
            const response = await request(url, headers, lastEventId, connection.signal)
            delayMs = retryMs
            onOpen()
            const parse = createEventParser(
                (event) => {
                    lastEventId = event.id ?? lastEventId
                    onEvent(event)
                },
                (serverDelayMs) => {
                    retryMs = serverDelayMs
                    delayMs = serverDelayMs
                },
            )
            const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader()
            if (reader !== undefined) await drain(reader, parse, watchSilence)
        } catch (error) {
            if (signal.aborted) return
            const reason: unknown = connection.signal.reason
            const failure = connection.signal.aborted && reason instanceof Error ? reason : error
            report?.(`[event stream] ${failure instanceof Error ? failure.message : "the stream failed"}`)
            if (error instanceof StreamRefusedError) return
        } finally {
            clearTimeout(silenceTimer)
            signal.removeEventListener("abort", stop)
            connection.abort()
        }
        await pause(randomFraction() * delayMs, signal)
        delayMs = Math.min(delayMs * 2, RECONNECT_POLICY.maxDelayMs)
        return attempt()
    }
    return attempt()
}
