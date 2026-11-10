import {
    fencedOff,
    newestFence,
    type CheckpointBlobRef,
    type CheckpointBlobRow,
    type CheckpointQuery,
    type CheckpointRef,
    type CheckpointRow,
    type CheckpointStore,
    type CheckpointStored,
    type CheckpointUsage,
    type CheckpointWriteRow,
    type CheckpointWriter,
} from "@modules/integrations/langgraph"

/** A row of any of the three checkpoint tables. */
export type AnyCheckpointRow = CheckpointRow | CheckpointBlobRow | CheckpointWriteRow

/** A stored row with the fence of the driver that wrote it. */
export interface FencedRow<Row> {
    /** The row. */
    readonly row: Row
    /** The fence it was written under, or null. */
    readonly fence: number | null
}

/** The checkpoint store in memory, with what a spec reads beside the port. */
export interface MemoryCheckpointStore {
    /** The port the saver is given. */
    readonly port: CheckpointStore
    /** A worker took the lease of the thread's scope: the lease row now holds `fence`. */
    readonly takeOver: (threadId: string, fence: number) => void
    /** Every stored row of a thread, of the three kinds, with its fence. */
    readonly rowsOf: (threadId: string) => ReadonlyArray<FencedRow<AnyCheckpointRow>>
    /** The stored values of one channel of a thread. */
    readonly valuesOf: (threadId: string, channel: string) => ReadonlyArray<CheckpointBlobRow>
}

const checkpointKey = (ref: CheckpointRef): string => JSON.stringify([ref.threadId, ref.namespace, ref.checkpointId])
const blobKey = (ref: CheckpointBlobRef): string =>
    JSON.stringify([ref.threadId, ref.namespace, ref.channel, ref.version])
const writeKey = (row: CheckpointWriteRow): string =>
    JSON.stringify([row.threadId, row.namespace, row.checkpointId, row.taskId, row.idx])
const rowsIn = <Row>(rows: ReadonlyMap<string, FencedRow<Row>>): Array<Row> =>
    [...rows.values()].map((stored) => stored.row)

/** The three tables of the store in memory. */
interface Tables {
    readonly checkpoints: Map<string, FencedRow<CheckpointRow>>
    readonly blobs: Map<string, FencedRow<CheckpointBlobRow>>
    readonly writes: Map<string, FencedRow<CheckpointWriteRow>>
}

/** The checkpoints a query names, newest id first, at most its limit. */
const matching = (rows: ReadonlyArray<CheckpointRow>, query: CheckpointQuery): Array<CheckpointRow> =>
    rows
        .filter((row) => row.workspaceId === query.workspaceId)
        .filter((row) => query.threadId === null || row.threadId === query.threadId)
        .filter((row) => query.namespace === null || row.namespace === query.namespace)
        .filter((row) => query.checkpointId === null || row.checkpointId === query.checkpointId)
        .filter((row) => query.before === null || row.checkpointId < query.before)
        .filter((row) =>
            Object.entries(query.metadata).every(
                ([key, value]) => JSON.stringify(row.metadata[key]) === JSON.stringify(value),
            ),
        )
        .toSorted((left, right) => (left.checkpointId < right.checkpointId ? 1 : -1))
        .slice(0, query.limit)

/** What one workspace's thread holds in the three tables. */
const usageOf = (tables: Tables, workspaceId: string, threadId: string): CheckpointUsage => {
    const mine = <Row extends AnyCheckpointRow>(rows: ReadonlyMap<string, FencedRow<Row>>): Array<Row> =>
        rowsIn(rows).filter((row) => row.workspaceId === workspaceId && row.threadId === threadId)
    const [checkpoints, blobs, writes] = [mine(tables.checkpoints), mine(tables.blobs), mine(tables.writes)]
    const bytes = [...checkpoints, ...blobs, ...writes].reduce((sum, row) => sum + row.payload.byteLength, 0)
    return { checkpoints: checkpoints.length, blobs: blobs.length, writes: writes.length, bytes }
}

/** Deletes the rows a condition names from the three tables. */
const deleteFrom = (tables: Tables, gone: (row: AnyCheckpointRow) => boolean): Promise<void> => {
    for (const rows of [tables.checkpoints, tables.blobs, tables.writes]) {
        for (const [key] of [...rows].filter(([, stored]) => gone(stored.row))) rows.delete(key)
    }
    return Promise.resolve()
}

/**
 * The store's contract in memory, keyed as the tables are (a thread id is one thread, whatever the workspace) and with the rules
 * their owner applies: a thread belongs to the workspace that first wrote it; the newest fence of a thread is the lease row's
 * (`takeOver`) or the highest stored on its rows; a read never crosses the workspace.
 */
export const memoryCheckpointStore = (): MemoryCheckpointStore => {
    const tables: Tables = { checkpoints: new Map(), blobs: new Map(), writes: new Map() }
    const { checkpoints: checkpointRows, blobs: blobRows, writes: writeRows } = tables
    const leases = new Map<string, number>()
    const all = (): Array<FencedRow<AnyCheckpointRow>> => [
        ...checkpointRows.values(),
        ...blobRows.values(),
        ...writeRows.values(),
    ]
    const rowsOf = (threadId: string): Array<FencedRow<AnyCheckpointRow>> =>
        all().filter((stored) => stored.row.threadId === threadId)
    const refused = (workspaceId: string, threadId: string, writer: CheckpointWriter): CheckpointStored | null => {
        const held = rowsOf(threadId)
        if (held.some((stored) => stored.row.workspaceId !== workspaceId)) return "foreign"
        return fencedOff(
            writer.fence,
            newestFence([leases.get(threadId) ?? null, ...held.map((stored) => stored.fence)]),
        )
            ? "fenced"
            : null
    }
    const checkpoints: CheckpointStore["checkpoints"] = (query) =>
        Promise.resolve(matching(rowsIn(checkpointRows), query))
    const put: CheckpointStore["put"] = (row, blobs, writer) => {
        const refusal = refused(row.workspaceId, row.threadId, writer)
        if (refusal !== null) return Promise.resolve(refusal)
        const parentCheckpointId =
            checkpointRows.get(checkpointKey(row))?.row.parentCheckpointId ?? row.parentCheckpointId
        checkpointRows.set(checkpointKey(row), { row: { ...row, parentCheckpointId }, fence: writer.fence })
        for (const blob of blobs.filter((value) => !blobRows.has(blobKey(value))))
            blobRows.set(blobKey(blob), { row: blob, fence: writer.fence })
        return Promise.resolve("stored")
    }
    const putWrites: CheckpointStore["putWrites"] = (rows, mode, writer) => {
        const [first] = rows
        const refusal = first === undefined ? null : refused(first.workspaceId, first.threadId, writer)
        if (refusal !== null) return Promise.resolve(refusal)
        for (const row of rows.filter((write) => mode === "replace" || !writeRows.has(writeKey(write))))
            writeRows.set(writeKey(row), { row, fence: writer.fence })
        return Promise.resolve("stored")
    }
    const port: CheckpointStore = {
        checkpoint: async (lookup) =>
            (await checkpoints({ ...lookup, before: null, metadata: {}, limit: 1 })).at(0) ?? null,
        checkpoints,
        blobs: (workspaceId, refs) => {
            const found = refs.map((ref) => blobRows.get(blobKey(ref))?.row).filter((row) => row !== undefined)
            return Promise.resolve(found.filter((row) => row.workspaceId === workspaceId))
        },
        writes: (workspaceId, refs) => {
            const wanted = new Set(refs.map((ref) => checkpointKey(ref)))
            return Promise.resolve(
                rowsIn(writeRows).filter((row) => row.workspaceId === workspaceId && wanted.has(checkpointKey(row))),
            )
        },
        put,
        putWrites,
        deleteThread: (threadId) => deleteFrom(tables, (row) => row.threadId === threadId),
        deleteWorkspaceThread: (workspaceId, threadId) =>
            deleteFrom(tables, (row) => row.workspaceId === workspaceId && row.threadId === threadId),
        usage: (workspaceId, threadId) => Promise.resolve(usageOf(tables, workspaceId, threadId)),
    }
    return {
        port,
        takeOver: (threadId, fence) => void leases.set(threadId, fence),
        rowsOf,
        valuesOf: (threadId, channel) =>
            rowsIn(blobRows).filter((row) => row.threadId === threadId && row.channel === channel),
    }
}
