import { createEventStream } from "@starci/event-stream"
import { renewSessionToken, sessionAccessToken } from "@/modules/auth"

/** Where a stream reports one failed attempt, as one line (the app's observability, when it wires one). */
export type StreamReporter = (line: string) => void

/**
 * The one event-stream client of the app: the session bearer token (renewed once on a 401), `Last-Event-ID` kept across reconnects, a
 * doubling backoff that honours the server's `retry`, and a heartbeat timeout. Each channel follows its own path with it.
 */
export const eventStream = createEventStream({
    getToken: sessionAccessToken,
    refreshToken: renewSessionToken,
})
