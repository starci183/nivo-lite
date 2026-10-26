/** One event the stream delivered: its id (the resume point the next request names in `Last-Event-ID`) and its data text. */
export interface ServerSentEvent {
    readonly id: string | undefined
    readonly data: string
}

/** Where a stream reports one failed attempt, as one line. */
export type StreamReporter = (line: string) => void

/** What following a stream takes. */
export interface FollowEventStreamParams {
    readonly url: string
    readonly headers?: Readonly<Record<string, string>>
    readonly signal: AbortSignal
    readonly onOpen: () => void
    readonly onEvent: (event: ServerSentEvent) => void
    readonly report?: StreamReporter
}

/**
 * MINIMAL STUB of the client lane (branch fix/v036-sse-client): that lane's `read-event-stream.ts` replaces this file at the
 * merge. It follows nothing; the contract is the signatures above.
 */
export const followEventStream = (params: FollowEventStreamParams): Promise<void> => {
    void params
    return Promise.resolve()
}
