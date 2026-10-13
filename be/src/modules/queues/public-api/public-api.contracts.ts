/** The jobs of the public-api queue; the value is the job name inside the queue and the prefix of the dedupe key. */
export enum PublicApiQueueJob {
    /**
     * Carries out one request the public API accepted. The processor reads the ledger row public.public_api named by the payload: its
     * kind (lead, message or knowledge) says which work to do, its payload holds the request body, and it sets processed_at when done.
     * A knowledge source is written with the ledger id as its own id.
     */
    Request = "public-api.request",
}

/** The payload of the request job: ids only (the processor re-reads the ledger row). */
export interface PublicApiRequestPayload {
    /** The ledger row of the accepted request. */
    readonly requestId: string
    /** The workspace of the key that sent the request: the workspace concurrency limit is keyed on it. */
    readonly workspaceId: string
}

/** The dedupe key of a request job: one job per ledger row, however often it is enqueued. */
export const publicApiDedupeKey = (requestId: string): string => `${PublicApiQueueJob.Request}:${requestId}`
