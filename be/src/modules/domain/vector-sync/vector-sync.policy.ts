import type { VectorFlags, VectorPayload, VectorRow, VectorStamp } from "@modules/integrations/qdrant"
import { NOTHING_SYNCED, type VectorSyncDone } from "./vector-sync.contracts"

/** The most texts one embedding call carries (the passages' and the truths' batch size). */
export const SYNC_EMBED_BATCH = 32

/** The most embedding calls one sync job makes: enough for every row a job may name (256 / 32). */
export const SYNC_EMBED_CALLS = 8

/** The rows, or the points, one page of the reconcile reads. */
export const RECONCILE_PAGE = 256

/** The most rows one run of the reconcile compares, per kind: 16 pages. */
export const RECONCILE_ROWS_PER_RUN = 4096

/** The most points one run of the reconcile checks for a row, per kind: 16 pages. */
export const RECONCILE_POINTS_PER_RUN = 4096

/** The most embedding calls one run of the reconcile makes, per kind: 1,024 rows, about half a minute at the provider's pace. */
export const RECONCILE_EMBED_CALLS = 32

/** After this many consecutive runs that ended with drift they could not repair (15 minutes at the tick's pace), the founder is told once. */
export const DRIFT_RUNS_TO_REPORT = 3

/** The most workspaces one run tells. */
export const REPORT_WORKSPACES_MAX = 20

/** What a batch of rows needs, row by row, once compared with the points the index holds for them. */
export interface SyncPlan {
    /** Rows whose point is in step and recorded in Postgres: nothing to do. */
    readonly settled: ReadonlyArray<VectorRow>
    /** Rows whose point is in step but Postgres has not recorded it yet. */
    readonly unstamped: ReadonlyArray<VectorRow>
    /** Rows whose point holds the right vector and other flags: its flags are rewritten. */
    readonly marks: ReadonlyArray<VectorRow>
    /** Rows with no point, or a point of another text, model or workspace: they need a vector. */
    readonly needs: ReadonlyArray<VectorRow>
    /** Rows that must hold no point and have one. */
    readonly removals: ReadonlyArray<VectorRow>
}

/** True when a point's flags are the row's. */
export const sameFlags = (held: VectorFlags, wanted: VectorFlags): boolean =>
    held.workspaceId === wanted.workspaceId &&
    held.sourceId === wanted.sourceId &&
    held.module === wanted.module &&
    held.installationId === wanted.installationId &&
    held.isPublic === wanted.isPublic &&
    held.customerReady === wanted.customerReady &&
    held.inForce === wanted.inForce

/** True when a point holds the vector of the row's text under the identity in use, for the row's workspace. */
const sameVector = (held: VectorPayload, row: VectorRow, model: string): boolean =>
    held.textHash === row.textHash && held.model === model && held.workspaceId === row.workspaceId

/**
 * Compares rows with the points the index holds for them and says what each needs. Idempotent by construction: the plan is a
 * function of the row (id, text hash, flags) and of its point (text hash, model, flags), so the same event replayed, or a run that
 * meets rows another run already settled, plans nothing.
 */
export const planOf = (rows: ReadonlyArray<VectorRow>, stamps: ReadonlyArray<VectorStamp>, model: string): SyncPlan => {
    const held = new Map(stamps.map((stamp) => [stamp.id, stamp.payload]))
    const plan = {
        settled: new Array<VectorRow>(),
        unstamped: new Array<VectorRow>(),
        marks: new Array<VectorRow>(),
        needs: new Array<VectorRow>(),
        removals: new Array<VectorRow>(),
    }
    for (const row of rows) {
        const point = held.get(row.id)
        if (!row.wanted) {
            if (point !== undefined) plan.removals.push(row)
        } else if (point === undefined || !sameVector(point, row, model)) plan.needs.push(row)
        else if (!sameFlags(point, row.mirror)) plan.marks.push(row)
        else if (row.stamped && row.stampedModel === model) plan.settled.push(row)
        else plan.unstamped.push(row)
    }
    return plan
}

/** The points whose row is not among the rows that want one: what a walk over the points removes, by the workspace each point names. */
export const orphansOf = (stamps: ReadonlyArray<VectorStamp>, wantedIds: ReadonlySet<string>): ReadonlyMap<string, ReadonlyArray<string>> => {
    const orphans = new Map<string, Array<string>>()
    for (const stamp of stamps) {
        if (wantedIds.has(stamp.id) || stamp.payload.workspaceId === "") continue
        const ids = orphans.get(stamp.payload.workspaceId) ?? []
        ids.push(stamp.id)
        orphans.set(stamp.payload.workspaceId, ids)
    }
    return orphans
}

/** The mirror a point of the row holds once written: the row's flags, the identity in use and the hash of its text. */
export const payloadOfRow = (row: VectorRow, model: string): VectorPayload => ({ ...row.mirror, model, textHash: row.textHash })

/** Rows grouped by their workspace. */
export const byWorkspace = (rows: ReadonlyArray<VectorRow>): ReadonlyMap<string, ReadonlyArray<VectorRow>> => {
    const groups = new Map<string, Array<VectorRow>>()
    for (const row of rows) groups.set(row.workspaceId, [...(groups.get(row.workspaceId) ?? []), row])
    return groups
}

/** Rows grouped by identical flags (the workspace is one of them): one rewrite of flags per group. */
export const byFlags = (rows: ReadonlyArray<VectorRow>): ReadonlyArray<{ readonly flags: VectorFlags; readonly ids: ReadonlyArray<string> }> => {
    const groups = new Map<string, { readonly flags: VectorFlags; readonly ids: Array<string> }>()
    for (const row of rows) {
        const { mirror } = row
        const key = [
            mirror.workspaceId,
            mirror.sourceId ?? "",
            mirror.module ?? "",
            mirror.installationId ?? "",
            mirror.isPublic ? "1" : "0",
            mirror.customerReady ? "1" : "0",
            mirror.inForce ? "1" : "0",
        ].join("|")
        const group = groups.get(key) ?? { flags: mirror, ids: [] }
        group.ids.push(row.id)
        groups.set(key, group)
    }
    return [...groups.values()]
}

/** A list cut into consecutive batches of a size. */
export const batchesOf = <Item>(items: ReadonlyArray<Item>, size: number): ReadonlyArray<ReadonlyArray<Item>> =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

/** Two counts of work added member by member. */
export const addDone = (left: VectorSyncDone, right: Partial<VectorSyncDone>): VectorSyncDone => ({
    unchanged: left.unchanged + (right.unchanged ?? 0),
    given: left.given + (right.given ?? 0),
    adopted: left.adopted + (right.adopted ?? 0),
    embedded: left.embedded + (right.embedded ?? 0),
    marked: left.marked + (right.marked ?? 0),
    removed: left.removed + (right.removed ?? 0),
    waiting: left.waiting + (right.waiting ?? 0),
    failed: left.failed + (right.failed ?? 0),
    embedCalls: left.embedCalls + (right.embedCalls ?? 0),
})

/** True when a sync changed the index. */
export const repairedSomething = (done: VectorSyncDone): boolean =>
    done.given + done.adopted + done.embedded + done.marked + done.removed > 0

/** Nothing done, as a fresh value to add to. */
export const noneDone = (): VectorSyncDone => ({ ...NOTHING_SYNCED })
