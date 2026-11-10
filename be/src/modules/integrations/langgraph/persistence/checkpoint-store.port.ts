/**
 * The port between the LangGraph checkpoint saver and the rows that hold a thread. The saver (this integration) owns everything the
 * library defines: serialisation, ids, ordering. The store owns the tables (`agent_checkpoints`, `agent_checkpoint_blobs`,
 * `agent_checkpoint_writes`) and the fence: it is a domain service, since an integration never reaches the database. No type of
 * `@langchain/*` crosses this file; a value is the saver's typed serialisation (`type` + `payload` bytes), opaque to the store.
 */

/** One checkpoint of a thread. `payload` is the checkpoint without its channel values; those are blobs, one per channel version. */
export interface CheckpointRow {
    /** The workspace the thread belongs to. */
    readonly workspaceId: string
    /** The thread: the run id. */
    readonly threadId: string
    /** The checkpoint namespace; empty for the thread's own graph. */
    readonly namespace: string
    /** The checkpoint id; ids of one thread sort by the time they were made. */
    readonly checkpointId: string
    /** The checkpoint this one continues, or null for the first. */
    readonly parentCheckpointId: string | null
    /** The type tag of the serialisation. */
    readonly type: string
    /** The serialised checkpoint. */
    readonly payload: Uint8Array
    /** The checkpoint's metadata as plain JSON; `list` filters on its top-level keys. */
    readonly metadata: Readonly<Record<string, unknown>>
}

/** The value one channel held at one version. It is written once and shared by every checkpoint that names that version. */
export interface CheckpointBlobRow {
    /** The workspace the thread belongs to. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The checkpoint namespace. */
    readonly namespace: string
    /** The channel. */
    readonly channel: string
    /** The channel version, as text. */
    readonly version: string
    /** The type tag of the serialisation. */
    readonly type: string
    /** The serialised value. */
    readonly payload: Uint8Array
}

/** One pending write of a checkpoint: what a task of the next super-step wrote. A finished task is replayed from these rows. */
export interface CheckpointWriteRow {
    /** The workspace the thread belongs to. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The checkpoint namespace. */
    readonly namespace: string
    /** The checkpoint the write is pending on. */
    readonly checkpointId: string
    /** The task that wrote. */
    readonly taskId: string
    /** The position of the write in its task; negative for the library's special writes (an error, an interrupt, a resume). */
    readonly idx: number
    /** The channel written. */
    readonly channel: string
    /** The type tag of the serialisation. */
    readonly type: string
    /** The serialised value. */
    readonly payload: Uint8Array
    /** The path of the task, the first part of the order writes are applied in; empty when the library gave none. */
    readonly taskPath: string
}

/** Names one checkpoint of a workspace; a null id names the newest of the thread's namespace. */
export interface CheckpointLookup {
    /** The workspace. */
    readonly workspaceId: string
    /** The thread. */
    readonly threadId: string
    /** The checkpoint namespace. */
    readonly namespace: string
    /** The checkpoint id, or null for the newest. */
    readonly checkpointId: string | null
}

/** Names one stored checkpoint. */
export interface CheckpointRef {
    /** The thread. */
    readonly threadId: string
    /** The checkpoint namespace. */
    readonly namespace: string
    /** The checkpoint id. */
    readonly checkpointId: string
}

/** Names the value of one channel at one version. */
export interface CheckpointBlobRef {
    /** The thread. */
    readonly threadId: string
    /** The checkpoint namespace. */
    readonly namespace: string
    /** The channel. */
    readonly channel: string
    /** The channel version, as text. */
    readonly version: string
}

/** What `checkpoints` lists: every condition is optional but the workspace and the bound. */
export interface CheckpointQuery {
    /** The workspace; a list never crosses it. */
    readonly workspaceId: string
    /** Only this thread, or null for every thread of the workspace. */
    readonly threadId: string | null
    /** Only this namespace, or null for every namespace. */
    readonly namespace: string | null
    /** Only this checkpoint id, or null. */
    readonly checkpointId: string | null
    /** Only checkpoints whose id sorts before this one, or null. */
    readonly before: string | null
    /** Only checkpoints whose metadata holds each of these top-level keys with an equal value; empty for no condition. */
    readonly metadata: Readonly<Record<string, unknown>>
    /** The most rows answered. */
    readonly limit: number
}

/** A lease fence, or null where there is none. */
export type OptionalFence = number | null

/** Who writes: the fence number of the lease the driver holds, or null when it holds none (a spec, a tool outside a drive). */
export interface CheckpointWriter {
    /** The fence of the writer's lease, or null. */
    readonly fence: OptionalFence
}

/** A stored checkpoint, or null when there is none. */
export type OptionalCheckpointRow = CheckpointRow | null

/**
 * What a write answered: `stored`; `fenced` when a newer driver owns the thread; `foreign` when the thread already holds rows of
 * another workspace (a thread belongs to the workspace that first wrote it). On a refusal nothing was written.
 */
export type CheckpointStored = "stored" | "fenced" | "foreign"

/** How writes that are already stored are treated: `keep` leaves a stored row as it is, `replace` overwrites it. */
export type CheckpointWriteMode = "keep" | "replace"

/** What one thread holds, for the size ceiling and the retention job. */
export interface CheckpointUsage {
    /** The checkpoints stored. */
    readonly checkpoints: number
    /** The channel values stored. */
    readonly blobs: number
    /** The pending writes stored. */
    readonly writes: number
    /** The bytes of every serialised checkpoint, value and write of the thread. */
    readonly bytes: number
}

/**
 * The rows of every thread. Each write is one short transaction of its own that takes the thread's lock, checks the fence and
 * writes; no call holds a transaction open between two calls, so none spans a model call.
 */
export interface CheckpointStore {
    /** One checkpoint, or the newest of the thread's namespace; null when there is none. */
    checkpoint(lookup: CheckpointLookup): Promise<OptionalCheckpointRow>
    /** The checkpoints a query names, newest id first, at most `limit`. */
    checkpoints(query: CheckpointQuery): Promise<ReadonlyArray<CheckpointRow>>
    /** The stored values among the named channel versions of a workspace; a version with no stored value is left out. */
    blobs(workspaceId: string, refs: ReadonlyArray<CheckpointBlobRef>): Promise<ReadonlyArray<CheckpointBlobRow>>
    /** The pending writes of the named checkpoints of a workspace, in no promised order. */
    writes(workspaceId: string, refs: ReadonlyArray<CheckpointRef>): Promise<ReadonlyArray<CheckpointWriteRow>>
    /**
     * Stores a checkpoint and the channel values it brought. A checkpoint stored before under the same id is replaced (type,
     * payload, metadata); a value already stored for its channel version is kept. `fenced` when the writer's fence is older than
     * the newest the thread holds.
     */
    put(
        row: CheckpointRow,
        blobs: ReadonlyArray<CheckpointBlobRow>,
        writer: CheckpointWriter,
    ): Promise<CheckpointStored>
    /** Stores the pending writes of one task on one checkpoint, under the same fence rule as `put`. */
    putWrites(
        rows: ReadonlyArray<CheckpointWriteRow>,
        mode: CheckpointWriteMode,
        writer: CheckpointWriter,
    ): Promise<CheckpointStored>
    /** Deletes every checkpoint, value and write of a thread, in whichever workspace the id is found: the library names none. */
    deleteThread(threadId: string): Promise<void>
    /** Deletes every checkpoint, value and write of one workspace's thread: what the retention job calls for an ended run. */
    deleteWorkspaceThread(workspaceId: string, threadId: string): Promise<void>
    /** What a thread holds. */
    usage(workspaceId: string, threadId: string): Promise<CheckpointUsage>
}
