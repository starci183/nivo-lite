import type { VectorKind } from "@modules/integrations/qdrant"

/** What an embedding call for the sync answered: the vectors, or why there are none. */
export type VectorsEmbedded =
    | { readonly kind: "vectors"; readonly vectors: ReadonlyArray<ReadonlyArray<number>> }
    /** The workspace's credit pool is empty: the rows wait, nothing failed. */
    | { readonly kind: "blocked" }
    /** The provider failed or answered another shape. */
    | { readonly kind: "failed" }

/** The embedding door the sync uses, bound by the app: credit-checked, booked to the workspace, the model the app embeds with. */
export interface VectorEmbedder {
    /** True when the deployment can embed at all. */
    configured(): boolean
    /** The embedding identity new vectors are made with (`<model>@<dimensions>`). */
    model(): string
    /** One vector per text, in order, for the workspace that pays; at most one provider call's worth of texts. */
    embed(workspaceId: string, texts: ReadonlyArray<string>): Promise<VectorsEmbedded>
}

/** The stop the reconcile reports: the upkeep of the meaning index, given up after its runs, for one episode. */
export interface VectorDriftReport {
    /** The background work that stopped. */
    readonly work: "brain.vectors.sync"
    /** Why: the runs could not repair what they met. */
    readonly reason: "gave_up"
    /** When the episode began: the same for every run of it, so the founder gets one card. */
    readonly episode: Date
}

/** What a post of a drift report did: posted, already told for this episode, or the workspace has no owner to tell. */
export type VectorDriftPosted = "posted" | "already" | "no_owner"

/**
 * Where a drift that outlived its runs is told: the app binds NIVO's background report (the team chat's notices) at composition, so
 * this capability never imports the chat.
 */
export interface VectorDriftReporter {
    /** Tells the founder of a workspace that the upkeep of the meaning index stopped, once per episode. */
    postBackgroundStopped(workspaceId: string, report: VectorDriftReport): Promise<VectorDriftPosted>
}

/** What one sync did, in rows. */
export interface VectorSyncDone {
    /** Rows whose point was already in step: nothing was sent for them. */
    readonly unchanged: number
    /** Points written with a vector the caller handed over (the embedding the writer just paid for). */
    readonly given: number
    /** Points written with the vector Postgres still held (the transition): no embedding call. */
    readonly copied: number
    /** Points written with the vector of another row's point of the same text: no embedding call, nothing booked. */
    readonly adopted: number
    /** Points written with a vector embedded now. */
    readonly embedded: number
    /** Points whose mirror was rewritten (flags changed, text did not). */
    readonly marked: number
    /** Points removed: their row is gone or no longer wants one. */
    readonly removed: number
    /** Rows that still have no point and wait: no credits, embeddings not configured, or the run's embedding budget is spent. */
    readonly waiting: number
    /** Rows whose embedding call failed: they have no point and are tried again. */
    readonly failed: number
    /** How many embedding calls were made (each is booked to its workspace). */
    readonly embedCalls: number
}

/** A sync that did nothing. */
export const NOTHING_SYNCED: VectorSyncDone = {
    unchanged: 0,
    given: 0,
    copied: 0,
    adopted: 0,
    embedded: 0,
    marked: 0,
    removed: 0,
    waiting: 0,
    failed: 0,
    embedCalls: 0,
}

/** How a sync may get the vector of a row that has no current point. */
export interface VectorSyncMeans {
    /** Vectors the caller already holds, by row id (made with the identity in use). */
    readonly given?: ReadonlyMap<string, ReadonlyArray<number>>
    /** The most embedding calls this sync may make; 0 = never embed (adoption only). */
    readonly embedCalls: number
}

/** What one run of the reconcile did for one kind. */
export interface VectorReconcileKindDone extends VectorSyncDone {
    /** Rows of Postgres the run compared with their points. */
    readonly rows: number
    /** Points of the index the run checked for a row. */
    readonly points: number
    /** True when the run ended a whole pass over the rows (the next run starts from the first row again). */
    readonly rowsWrapped: boolean
    /** True when the run ended a whole pass over the points. */
    readonly pointsWrapped: boolean
}

/** What one run of the reconcile did. */
export interface VectorReconcileDone {
    /** off = the deployment has no vector index; ran = the run finished; stopped = the index or an embedding call failed mid-run. */
    readonly outcome: "off" | "ran" | "stopped"
    /** What was done per kind. */
    readonly kinds: Readonly<Partial<Record<VectorKind, VectorReconcileKindDone>>>
    /** True when a follow-up run was queued: the run repaired something and used its whole budget. */
    readonly continued: boolean
    /** How many consecutive runs have ended with drift they could not repair. */
    readonly driftRuns: number
    /** How many workspaces were told in this run (once per episode). */
    readonly reported: number
}
