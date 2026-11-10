import { Injectable } from "@nestjs/common"
import { In, IsNull, Not, type EntityManager } from "typeorm"
import {
    fencedOff,
    newestFence,
    type CheckpointBlobRef,
    type CheckpointBlobRow,
    type CheckpointLookup,
    type CheckpointQuery,
    type CheckpointRef,
    type CheckpointRow,
    type CheckpointStore,
    type CheckpointStored,
    type CheckpointUsage,
    type CheckpointWriteMode,
    type CheckpointWriteRow,
    type CheckpointWriter,
    type OptionalCheckpointRow,
} from "@modules/integrations/langgraph"
import { advisoryXactLock, InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentCheckpointBlobEntity, AgentCheckpointEntity, AgentCheckpointWriteEntity } from "./persistence/entities"

/** The most value or write rows one read answers: the rows of the checkpoints one list names. */
const READ_MAX = 20_000

/** The columns a checkpoint stored again under the same id replaces; its parent and its workspace stay as first written. */
const CHECKPOINT_REPLACED = ["checkpoint_type", "checkpoint", "metadata", "fence"]
const CHECKPOINT_KEY = ["thread_id", "checkpoint_ns", "checkpoint_id"]
const WRITE_REPLACED = ["channel", "value_type", "value", "task_path", "fence"]
const WRITE_KEY = ["thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx"]

/** The advisory lock every write of one thread takes first, so the fence check and the write are one step. */
const lockKeyOf = (threadId: string): string => `agent-checkpoint:${threadId}`

const checkpointRowOf = (entity: AgentCheckpointEntity): CheckpointRow => ({
    workspaceId: entity.workspaceId,
    threadId: entity.threadId,
    namespace: entity.checkpointNs,
    checkpointId: entity.checkpointId,
    parentCheckpointId: entity.parentCheckpointId,
    type: entity.checkpointType,
    payload: entity.checkpoint,
    metadata: entity.metadata,
})

const blobRowOf = (entity: AgentCheckpointBlobEntity): CheckpointBlobRow => ({
    workspaceId: entity.workspaceId,
    threadId: entity.threadId,
    namespace: entity.checkpointNs,
    channel: entity.channel,
    version: entity.version,
    type: entity.valueType,
    payload: entity.value,
})

const writeRowOf = (entity: AgentCheckpointWriteEntity): CheckpointWriteRow => ({
    workspaceId: entity.workspaceId,
    threadId: entity.threadId,
    namespace: entity.checkpointNs,
    checkpointId: entity.checkpointId,
    taskId: entity.taskId,
    idx: entity.idx,
    channel: entity.channel,
    type: entity.valueType,
    payload: entity.value,
    taskPath: entity.taskPath,
})

/** The rows of a thread, in one workspace or wherever the id is. */
interface ThreadRows {
    readonly threadId: string
    readonly workspaceId?: string
}

/** Why a write is refused, or null when it may go on. */
type CheckpointRefusal = Exclude<CheckpointStored, "stored"> | null

const unique = (values: ReadonlyArray<string>): Array<string> => [...new Set(values)]

@Injectable()
/**
 * The rows of every LangGraph thread: the `CheckpointStore` the saver of `integrations/langgraph` reads and writes through. Each
 * write is one short transaction: the thread's advisory lock, the fence check, the rows. Nothing here knows the library.
 */
export class AgentCheckpointsService implements CheckpointStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** One checkpoint, or the newest of the thread's namespace; null when there is none. */
    async checkpoint(lookup: CheckpointLookup): Promise<OptionalCheckpointRow> {
        const named = lookup.checkpointId === null ? {} : { checkpointId: lookup.checkpointId }
        const entity = await this.entityManager.findOne(AgentCheckpointEntity, {
            where: {
                workspaceId: lookup.workspaceId,
                threadId: lookup.threadId,
                checkpointNs: lookup.namespace,
                ...named,
            },
            order: { checkpointId: "DESC" },
        })
        return entity === null ? null : checkpointRowOf(entity)
    }

    /** The checkpoints a query names, newest id first, at most `limit`. */
    async checkpoints(query: CheckpointQuery): Promise<ReadonlyArray<CheckpointRow>> {
        const builder = this.entityManager
            .createQueryBuilder(AgentCheckpointEntity, "c")
            .where("c.workspaceId = :workspaceId", { workspaceId: query.workspaceId })
        if (query.threadId !== null) builder.andWhere("c.threadId = :threadId", { threadId: query.threadId })
        if (query.namespace !== null) builder.andWhere("c.checkpointNs = :namespace", { namespace: query.namespace })
        if (query.checkpointId !== null)
            builder.andWhere("c.checkpointId = :checkpointId", { checkpointId: query.checkpointId })
        if (query.before !== null) builder.andWhere("c.checkpointId < :before", { before: query.before })
        if (Object.keys(query.metadata).length > 0)
            builder.andWhere("c.metadata @> CAST(:metadata AS jsonb)", { metadata: JSON.stringify(query.metadata) })
        const entities = await builder.orderBy("c.checkpointId", "DESC").limit(query.limit).getMany()
        return entities.map((entity) => checkpointRowOf(entity))
    }

    /** The stored values among the named channel versions; one read for all of them, narrowed to the exact versions in memory. */
    async blobs(
        workspaceId: string,
        refs: ReadonlyArray<CheckpointBlobRef>,
    ): Promise<ReadonlyArray<CheckpointBlobRow>> {
        if (refs.length === 0) return []
        const wanted = new Set(
            refs.map((ref) => JSON.stringify([ref.threadId, ref.namespace, ref.channel, ref.version])),
        )
        const entities = await this.entityManager.find(AgentCheckpointBlobEntity, {
            where: {
                workspaceId,
                threadId: In(unique(refs.map((ref) => ref.threadId))),
                channel: In(unique(refs.map((ref) => ref.channel))),
                version: In(unique(refs.map((ref) => ref.version))),
            },
            take: READ_MAX,
        })
        return entities
            .map((entity) => blobRowOf(entity))
            .filter((row) => wanted.has(JSON.stringify([row.threadId, row.namespace, row.channel, row.version])))
    }

    /** The pending writes of the named checkpoints; one read for all of them. */
    async writes(workspaceId: string, refs: ReadonlyArray<CheckpointRef>): Promise<ReadonlyArray<CheckpointWriteRow>> {
        if (refs.length === 0) return []
        const wanted = new Set(refs.map((ref) => JSON.stringify([ref.threadId, ref.namespace, ref.checkpointId])))
        const entities = await this.entityManager.find(AgentCheckpointWriteEntity, {
            where: {
                workspaceId,
                threadId: In(unique(refs.map((ref) => ref.threadId))),
                checkpointId: In(unique(refs.map((ref) => ref.checkpointId))),
            },
            take: READ_MAX,
        })
        return entities
            .map((entity) => writeRowOf(entity))
            .filter((row) => wanted.has(JSON.stringify([row.threadId, row.namespace, row.checkpointId])))
    }

    /** Stores a checkpoint and the channel values it brought, unless a newer driver owns the thread. */
    put(
        row: CheckpointRow,
        blobs: ReadonlyArray<CheckpointBlobRow>,
        writer: CheckpointWriter,
    ): Promise<CheckpointStored> {
        return this.entityManager.transaction(async (manager): Promise<CheckpointStored> => {
            const refusal = await this.refusal(manager, row.workspaceId, row.threadId, writer)
            if (refusal !== null) return refusal
            await manager
                .createQueryBuilder(AgentCheckpointEntity, "c")
                .insert()
                .values({
                    workspaceId: row.workspaceId,
                    threadId: row.threadId,
                    checkpointNs: row.namespace,
                    checkpointId: row.checkpointId,
                    parentCheckpointId: row.parentCheckpointId,
                    checkpointType: row.type,
                    checkpoint: Buffer.from(row.payload),
                    metadata: () => "CAST(:metadata AS jsonb)",
                    fence: writer.fence,
                })
                .orUpdate(CHECKPOINT_REPLACED, CHECKPOINT_KEY)
                .setParameter("metadata", JSON.stringify(row.metadata))
                .execute()
            if (blobs.length === 0) return "stored"
            await manager
                .createQueryBuilder(AgentCheckpointBlobEntity, "b")
                .insert()
                .values(
                    blobs.map((blob) => ({
                        workspaceId: blob.workspaceId,
                        threadId: blob.threadId,
                        checkpointNs: blob.namespace,
                        channel: blob.channel,
                        version: blob.version,
                        valueType: blob.type,
                        value: Buffer.from(blob.payload),
                        fence: writer.fence,
                    })),
                )
                .orIgnore()
                .execute()
            return "stored"
        })
    }

    /** Stores the pending writes of one task on one checkpoint, under the same fence rule as `put`. */
    putWrites(
        rows: ReadonlyArray<CheckpointWriteRow>,
        mode: CheckpointWriteMode,
        writer: CheckpointWriter,
    ): Promise<CheckpointStored> {
        const [first] = rows
        if (first === undefined) return Promise.resolve("stored")
        return this.entityManager.transaction(async (manager): Promise<CheckpointStored> => {
            const refusal = await this.refusal(manager, first.workspaceId, first.threadId, writer)
            if (refusal !== null) return refusal
            const insert = manager
                .createQueryBuilder(AgentCheckpointWriteEntity, "w")
                .insert()
                .values(
                    rows.map((row) => ({
                        workspaceId: row.workspaceId,
                        threadId: row.threadId,
                        checkpointNs: row.namespace,
                        checkpointId: row.checkpointId,
                        taskId: row.taskId,
                        idx: row.idx,
                        channel: row.channel,
                        valueType: row.type,
                        value: Buffer.from(row.payload),
                        taskPath: row.taskPath,
                        fence: writer.fence,
                    })),
                )
            await (mode === "replace" ? insert.orUpdate(WRITE_REPLACED, WRITE_KEY) : insert.orIgnore()).execute()
            return "stored"
        })
    }

    /** Deletes every checkpoint, value and write of a thread, in whichever workspace the id is found. */
    deleteThread(threadId: string): Promise<void> {
        return this.deleted({ threadId })
    }

    /** Deletes every checkpoint, value and write of one workspace's thread. */
    deleteWorkspaceThread(workspaceId: string, threadId: string): Promise<void> {
        return this.deleted({ workspaceId, threadId })
    }

    /** Deletes the rows of the three tables a condition names, in one transaction. */
    private async deleted(where: ThreadRows): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            await manager.delete(AgentCheckpointWriteEntity, where)
            await manager.delete(AgentCheckpointBlobEntity, where)
            await manager.delete(AgentCheckpointEntity, where)
        })
    }

    /** What a thread holds: its rows and the bytes of their serialised values. */
    async usage(workspaceId: string, threadId: string): Promise<CheckpointUsage> {
        const where = { workspaceId, threadId }
        const [checkpoints, blobs, writes] = await Promise.all([
            this.entityManager.find(AgentCheckpointEntity, { where, select: { checkpoint: true }, take: READ_MAX }),
            this.entityManager.find(AgentCheckpointBlobEntity, { where, select: { value: true }, take: READ_MAX }),
            this.entityManager.find(AgentCheckpointWriteEntity, { where, select: { value: true }, take: READ_MAX }),
        ])
        const bytes = [
            ...checkpoints.map((row) => row.checkpoint),
            ...blobs.map((row) => row.value),
            ...writes.map((row) => row.value),
        ].reduce((sum, value) => sum + value.byteLength, 0)
        return { checkpoints: checkpoints.length, blobs: blobs.length, writes: writes.length, bytes }
    }

    /**
     * Takes the thread's lock for the transaction and says why the write is refused, or null. `foreign`: the thread already holds a
     * checkpoint of another workspace (the tables' keys carry no workspace, so this check is what keeps one workspace from writing
     * over another's rows). `fenced`: the writer's fence is older than the newest stored on the thread's checkpoints and writes (a
     * value row is always written with its checkpoint, so it adds no fence). The lease row of the thread's scope is not read here:
     * the writer names only its fence, so a superseded driver is refused from the new driver's first write on.
     */
    private async refusal(
        manager: EntityManager,
        workspaceId: string,
        threadId: string,
        writer: CheckpointWriter,
    ): Promise<CheckpointRefusal> {
        await advisoryXactLock(manager, lockKeyOf(threadId))
        if (await manager.exists(AgentCheckpointEntity, { where: { threadId, workspaceId: Not(workspaceId) } }))
            return "foreign"
        const where = { workspaceId, threadId, fence: Not(IsNull()) }
        const checkpoint = await manager.findOne(AgentCheckpointEntity, {
            where,
            order: { fence: "DESC" },
            select: { fence: true },
        })
        const write = await manager.findOne(AgentCheckpointWriteEntity, {
            where,
            order: { fence: "DESC" },
            select: { fence: true },
        })
        return fencedOff(writer.fence, newestFence([checkpoint?.fence ?? null, write?.fence ?? null])) ? "fenced" : null
    }
}
