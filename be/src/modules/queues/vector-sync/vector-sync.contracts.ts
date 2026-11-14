/** The queue name: the contract between the producers, the tick `vector-reconcile` of platform/jobs and the two processors (the durable queue name). */
export const VECTOR_SYNC_QUEUE = "vector_sync"

/** The jobs of the vector-sync queue; the value is the job name inside the queue and the prefix of the dedupe key. */
export enum VectorSyncJob {
    /** Brings the points of some Postgres rows in step with the rows: written with the change of the rows, in its transaction. */
    Sync = "vector.sync",
    /** One bounded run of the reconcile over every row and every point: the tick's job, and its own follow-up while there is work. */
    Reconcile = "vector.reconcile",
}

/** What a point is of, as the queue names it (the vector index's kinds: every row kind that declares it is embedded). */
export type VectorSyncKind = "passage" | "truth" | "base"

/** The kinds a sync job may name. */
const SYNC_KINDS: ReadonlyArray<unknown> = ["passage", "truth", "base"] satisfies ReadonlyArray<VectorSyncKind>

/** The most row ids one sync job names; a writer with more writes several jobs or names the document. */
export const VECTOR_SYNC_IDS_MAX = 256

/**
 * The payload of the sync job: WHICH rows changed, ids only; the handler re-reads the rows (Postgres is the system of record) and
 * never trusts the payload for what they hold. Exactly one of `ids` and `sourceId` names them:
 * - `ids`: these rows (truths put in force, superseded, retired, expired, switched to another reach; single passages);
 * - `sourceId`: every passage of this document, and every point the index still holds for it (indexed, read again, replaced,
 *   deleted, its readers or its release to customers changed). A deleted document has no rows left: its points are removed.
 */
export interface VectorSyncPayload {
    /** What the rows are. */
    readonly kind: VectorSyncKind
    /**
     * The tenant that owns them (a workspace, or the platform tenant of the base knowledge): a workspace's jobs count against its
     * concurrency limit, and no point of another tenant is touched.
     */
    readonly workspaceId: string
    /** The rows, at most `VECTOR_SYNC_IDS_MAX`. */
    readonly ids?: ReadonlyArray<string>
    /** The document whose passages changed (kind `passage` only). */
    readonly sourceId?: string
    /** When the change was written, epoch milliseconds: two changes of the same rows are two jobs, the same change written twice is one. */
    readonly at: number
}

/** The payload of the reconcile job: nothing for the tick's run; `resumedAt` keys the follow-up of a run that used its whole budget. */
export interface VectorReconcilePayload {
    /** When the run that asked for this follow-up ended, epoch milliseconds; absent on the tick's own job. */
    readonly resumedAt?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const isIds = (value: unknown): value is ReadonlyArray<string> =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= VECTOR_SYNC_IDS_MAX &&
    value.every((id) => typeof id === "string" && id !== "")

/** True when a job payload is the payload of a sync job: a kind, a workspace, a time, and exactly one of the ids and the document. */
export const isVectorSyncPayload = (value: unknown): value is VectorSyncPayload => {
    if (!isRecord(value) || !SYNC_KINDS.includes(value.kind)) return false
    if (typeof value.workspaceId !== "string" || typeof value.at !== "number" || !Number.isFinite(value.at)) return false
    if (value.sourceId !== undefined) {
        return value.ids === undefined && value.kind === "passage" && typeof value.sourceId === "string" && value.sourceId !== ""
    }
    return isIds(value.ids)
}

/** True when a job payload is the payload of a reconcile job. */
export const isVectorReconcilePayload = (value: unknown): value is VectorReconcilePayload =>
    isRecord(value) && (value.resumedAt === undefined || typeof value.resumedAt === "number")

/**
 * How long the changes of one document are gathered into ONE sync job, milliseconds. A document changes several times in a row (indexed,
 * critiqued, released to customers, its readers switched); each change used to be its own job (brain walk 3, D-R-9: 1,465 jobs for a
 * 19.8 MB upload). The job of a window runs once the window has closed and re-reads the document, so it carries every change of it.
 */
export const SOURCE_SYNC_WINDOW_MS = 15_000

/** The window a change written at `at` (epoch ms) falls in. */
const windowOf = (at: number): number => Math.floor(at / SOURCE_SYNC_WINDOW_MS)

/**
 * The dedupe key of a sync job. Rows by id: the kind, the workspace, the first row and how many, and when the change was written (the
 * same change enqueued twice is one job; a later change is another). A document: the workspace, the document and the WINDOW its change
 * falls in, so every change of the document inside one window is the same job.
 */
export const vectorSyncDedupeKey = (payload: VectorSyncPayload): string => {
    if (payload.sourceId !== undefined) {
        return `${VectorSyncJob.Sync}:${payload.kind}:${payload.workspaceId}:${payload.sourceId}:w${String(windowOf(payload.at))}`
    }
    const subject = `${payload.ids?.[0] ?? ""}+${String(payload.ids?.length ?? 0)}`
    return `${VectorSyncJob.Sync}:${payload.kind}:${payload.workspaceId}:${subject}:${String(payload.at)}`
}

/**
 * How long the broker holds a sync job before it runs, milliseconds: a document's job waits for its window to close (a change written
 * after the job started falls in the next window, hence in the next job); rows by id run at once.
 */
export const vectorSyncDelayOf = (payload: VectorSyncPayload): number =>
    payload.sourceId === undefined ? 0 : (windowOf(payload.at) + 1) * SOURCE_SYNC_WINDOW_MS - payload.at

/** The dedupe key of the follow-up of a reconcile run. */
export const vectorReconcileDedupeKey = (resumedAt: number): string => `${VectorSyncJob.Reconcile}:next:${String(resumedAt)}`
