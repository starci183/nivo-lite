import { randomInt } from "node:crypto"
import type { RunnableConfig } from "@langchain/core/runnables"
import {
    BaseCheckpointSaver,
    TASKS,
    WRITES_IDX_MAP,
    copyCheckpoint,
    maxChannelVersion,
    type ChannelVersions,
    type Checkpoint,
    type CheckpointListOptions,
    type CheckpointMetadata,
    type CheckpointPendingWrite,
    type CheckpointTuple,
    type PendingWrite,
} from "@langchain/langgraph-checkpoint"
import { Injectable, Optional } from "@nestjs/common"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { LanggraphError, LanggraphErrorCode } from "../errors/langgraph.error"
import { THREAD_CONFIG } from "../langgraph.port"
import { addressOf, keyOf, pathOf, plainRecordOf, required, type CheckpointAddress } from "./checkpoint-config.policy"
import { InjectCheckpointLimits, InjectCheckpointStore } from "./checkpoint.decorators"
import { CheckpointLogEvent } from "./checkpoint.log-events"
import { blobKeyOf, checkpointKeyOf, orderedWrites, tupleConfigOf } from "./checkpoint-tuple.mapper"
import { checkpointOf, metadataOf } from "./checkpoint-shape.policy"
import { DEFAULT_CHECKPOINT_LIMITS, listLimitOf, sizeOf, type CheckpointLimits } from "./checkpoint-size.policy"
import type {
    CheckpointBlobRef,
    CheckpointBlobRow,
    CheckpointRef,
    CheckpointRow,
    CheckpointStore,
    CheckpointStored,
    CheckpointWriteRow,
} from "./checkpoint-store.port"

/** The library's key of `config.configurable` that names a checkpoint. */
const CHECKPOINT_KEY = "checkpoint_id"

/** The checkpoint format from which the library keeps pending sends in the checkpoint itself; older ones are migrated on read. */
const SENDS_IN_CHECKPOINT = 4

/** The steps between two fractions a channel version may carry: enough that two drivers never mint the same one. */
const VERSION_FRACTIONS = 2 ** 40

/** What a stored value is, for the size log. */
type StoredWhat = "checkpoint" | "value" | "write"

@Injectable()
/**
 * The checkpoint saver of every NIVO thread: the library's `BaseCheckpointSaver` over the NIVO store. It replaces the stock
 * Postgres saver, which creates its tables at run time, opens its own pool and has no tenant column. Here every row carries the
 * workspace, read from `config.configurable` on each call; every write carries the fence of the caller's lease and is refused when
 * a newer driver owns the thread; and each channel value is stored once per version, so a checkpoint row stays small however
 * large the state is. The saver holds no state of its own and opens no transaction: each store call is one short transaction.
 */
export class CheckpointSaverClient extends BaseCheckpointSaver<number> {
    constructor(
        @InjectCheckpointStore() private readonly store: CheckpointStore,
        @InjectLogger() private readonly logger: Logger,
        @Optional() @InjectCheckpointLimits() private readonly limits: CheckpointLimits = DEFAULT_CHECKPOINT_LIMITS,
    ) {
        super()
    }

    /**
     * The next version of a channel: one past the whole part of the current one, plus a random fraction. Values are stored per
     * channel and version, so two drivers that continue from the same checkpoint (a superseded one and its successor) would mint
     * the same version and the later value would be dropped for the earlier; the fraction keeps their values apart.
     */
    override getNextVersion(current: number | undefined): number {
        return Math.floor(super.getNextVersion(current)) + randomInt(1, VERSION_FRACTIONS) / VERSION_FRACTIONS
    }

    /** The newest checkpoint of a thread's namespace, or the one the config names; undefined when there is none. */
    override async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
        const address = addressOf(config.configurable)
        if (address.threadId === null) return undefined
        const workspaceId = this.workspaceOf(address)
        const row = await this.store.checkpoint({
            workspaceId,
            threadId: address.threadId,
            namespace: address.namespace ?? "",
            checkpointId: address.checkpointId,
        })
        if (row === null) return undefined
        const [tuple] = await this.tuplesOf(workspaceId, [row])
        return tuple
    }

    /** The checkpoints of a workspace the config and the options name, newest first, at most the list limit. */
    override async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
        const address = addressOf(config.configurable)
        const workspaceId = this.workspaceOf(address)
        const rows = await this.store.checkpoints({
            workspaceId,
            threadId: address.threadId,
            namespace: address.namespace,
            checkpointId: address.checkpointId,
            before: addressOf(options?.before?.configurable).checkpointId,
            metadata: plainRecordOf(options?.filter),
            limit: listLimitOf(options?.limit, this.limits),
        })
        for (const tuple of await this.tuplesOf(workspaceId, rows)) yield tuple
    }

    /**
     * Stores a checkpoint: the checkpoint without its channel values as one row, and the value of each channel `newVersions` names
     * as one row per version. A fenced-off writer is refused and nothing is written.
     */
    override async put(
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        newVersions: ChannelVersions,
    ): Promise<RunnableConfig> {
        if (config.configurable === undefined)
            throw new LanggraphError({
                code: LanggraphErrorCode.CheckpointScopeMissing,
                params: { key: "configurable" },
            })
        const address = addressOf(config.configurable)
        const threadId = required(address.threadId, THREAD_CONFIG.thread)
        const workspaceId = this.workspaceOf(address)
        const ref: CheckpointRef = {
            threadId,
            namespace: address.namespace ?? "",
            checkpointId: keyOf(checkpoint.id, CHECKPOINT_KEY),
        }
        const prepared = copyCheckpoint(checkpoint)
        const [type, payload] = await this.serde.dumpsTyped({ ...prepared, channel_values: {} })
        this.measured(threadId, "checkpoint", ref.checkpointId, payload)
        const blobs = await this.blobsOf(workspaceId, ref, prepared.channel_values, newVersions)
        const row: CheckpointRow = {
            workspaceId,
            ...ref,
            parentCheckpointId: address.checkpointId,
            type,
            payload,
            metadata: plainRecordOf(metadata),
        }
        this.accepted(await this.store.put(row, blobs, { fence: address.fence }), address, threadId)
        return tupleConfigOf(ref)
    }

    /**
     * Stores what one task wrote on a checkpoint. A task's ordinary writes are kept as first stored, so a replayed task cannot
     * change them; the library's special writes (an error, an interrupt, a resume) replace the stored ones.
     */
    override async putWrites(
        config: RunnableConfig,
        writes: Array<PendingWrite>,
        taskId: string,
        taskPath?: string,
    ): Promise<void> {
        const address = addressOf(config.configurable)
        const threadId = required(address.threadId, THREAD_CONFIG.thread)
        const checkpointId = required(address.checkpointId, CHECKPOINT_KEY)
        const workspaceId = this.workspaceOf(address)
        const task = keyOf(taskId, "task_id")
        const path = pathOf(taskPath ?? "", "task_path")
        const rows = await Promise.all(
            writes.map(async ([channel, value], index): Promise<CheckpointWriteRow> => {
                const [type, payload] = await this.serde.dumpsTyped(value)
                this.measured(threadId, "write", channel, payload)
                return {
                    workspaceId,
                    threadId,
                    namespace: address.namespace ?? "",
                    checkpointId,
                    taskId: task,
                    idx: WRITES_IDX_MAP[channel] ?? index,
                    channel: keyOf(channel, "channel"),
                    type,
                    payload,
                    taskPath: path,
                }
            }),
        )
        if (rows.length === 0) return
        const special = writes.every(([channel]) => channel in WRITES_IDX_MAP)
        this.accepted(
            await this.store.putWrites(rows, special ? "replace" : "keep", { fence: address.fence }),
            address,
            threadId,
        )
    }

    /** Deletes every checkpoint, value and write of a thread, wherever it is: the library names no workspace here. */
    override async deleteThread(threadId: string): Promise<void> {
        await this.store.deleteThread(keyOf(threadId, THREAD_CONFIG.thread))
    }

    /** The workspace a call is addressed to. Every call names one: a row is never read or written across workspaces. */
    protected workspaceOf(address: CheckpointAddress): string {
        return required(address.workspaceId, THREAD_CONFIG.workspace)
    }

    /** Throws when the store refused the write for its fence. */
    private accepted(stored: CheckpointStored, address: CheckpointAddress, threadId: string): void {
        if (stored === "stored") return
        if (stored === "foreign")
            throw new LanggraphError({
                code: LanggraphErrorCode.CheckpointScopeMissing,
                params: { key: THREAD_CONFIG.workspace },
            })
        this.logger.warn(CheckpointLogEvent.WriteFenced, { thread: threadId, fence: address.fence })
        throw new LanggraphError({
            code: LanggraphErrorCode.CheckpointFenced,
            params: { thread: threadId, fence: String(address.fence) },
        })
    }

    /** Reads a stored value's size against the limits: refuses one over the maximum, logs a large one. */
    private measured(threadId: string, what: StoredWhat, name: string, payload: Uint8Array): void {
        const size = sizeOf(payload.byteLength, this.limits)
        if (size === "refused") {
            throw new LanggraphError({
                code: LanggraphErrorCode.CheckpointTooLarge,
                params: { thread: threadId, bytes: String(payload.byteLength), limit: String(this.limits.maxBytes) },
            })
        }
        if (size === "large")
            this.logger.warn(CheckpointLogEvent.ValueLarge, { thread: threadId, what, name, bytes: payload.byteLength })
    }

    /** The value rows of the channels a checkpoint changed; a channel named without a value stores nothing. */
    private blobsOf(
        workspaceId: string,
        ref: CheckpointRef,
        values: Readonly<Record<string, unknown>>,
        versions: ChannelVersions,
    ): Promise<Array<CheckpointBlobRow>> {
        const changed = Object.entries(versions).filter(
            ([channel]) => Object.hasOwn(values, channel) && values[channel] !== undefined,
        )
        return Promise.all(
            changed.map(async ([channel, version]): Promise<CheckpointBlobRow> => {
                const [type, payload] = await this.serde.dumpsTyped(values[channel])
                this.measured(ref.threadId, "value", channel, payload)
                return {
                    workspaceId,
                    threadId: ref.threadId,
                    namespace: ref.namespace,
                    channel: keyOf(channel, "channel"),
                    version: String(version),
                    type,
                    payload,
                }
            }),
        )
    }

    /** Builds the tuples of stored checkpoints with two more reads for all of them: their channel values and their pending writes. */
    private async tuplesOf(workspaceId: string, rows: ReadonlyArray<CheckpointRow>): Promise<Array<CheckpointTuple>> {
        if (rows.length === 0) return []
        const loaded = await Promise.all(rows.map(async (row) => ({ row, checkpoint: await this.loaded(row) })))
        const blobRefs = loaded.flatMap(({ row, checkpoint }) =>
            Object.entries(checkpoint.channel_versions).map(([channel, version]): CheckpointBlobRef => ({
                threadId: row.threadId,
                namespace: row.namespace,
                channel,
                version: String(version),
            })),
        )
        const writeRefs = loaded.flatMap(({ row, checkpoint }): Array<CheckpointRef> => {
            const own: CheckpointRef = {
                threadId: row.threadId,
                namespace: row.namespace,
                checkpointId: row.checkpointId,
            }
            const migrates = checkpoint.v < SENDS_IN_CHECKPOINT && row.parentCheckpointId !== null
            return migrates ? [own, { ...own, checkpointId: row.parentCheckpointId }] : [own]
        })
        const [blobs, writes] = await Promise.all([
            this.store.blobs(workspaceId, blobRefs),
            this.store.writes(workspaceId, writeRefs),
        ])
        const blobAt = new Map(blobs.map((blob) => [blobKeyOf(blob), blob]))
        const writesAt = new Map<string, Array<CheckpointWriteRow>>()
        for (const write of writes)
            writesAt.set(checkpointKeyOf(write), [...(writesAt.get(checkpointKeyOf(write)) ?? []), write])
        return Promise.all(loaded.map(({ row, checkpoint }) => this.tupleOf(row, checkpoint, blobAt, writesAt)))
    }

    /** The stored checkpoint, read back; its channel values are filled by the caller. */
    private async loaded(row: CheckpointRow): Promise<Checkpoint> {
        const stored: unknown = await this.serde.loadsTyped(row.type, row.payload)
        return checkpointOf(stored, row.threadId)
    }

    /** One tuple: the checkpoint with the values of its channel versions, its metadata, its parent and its pending writes in order. */
    private async tupleOf(
        row: CheckpointRow,
        checkpoint: Checkpoint,
        blobAt: ReadonlyMap<string, CheckpointBlobRow>,
        writesAt: ReadonlyMap<string, ReadonlyArray<CheckpointWriteRow>>,
    ): Promise<CheckpointTuple> {
        const ref: CheckpointRef = { threadId: row.threadId, namespace: row.namespace, checkpointId: row.checkpointId }
        const values = await Promise.all(
            Object.entries(checkpoint.channel_versions).map(
                async ([channel, version]): Promise<[string, unknown] | null> => {
                    const blob = blobAt.get(
                        blobKeyOf({
                            threadId: row.threadId,
                            namespace: row.namespace,
                            channel,
                            version: String(version),
                        }),
                    )
                    return blob === undefined ? null : [channel, await this.serde.loadsTyped(blob.type, blob.payload)]
                },
            ),
        )
        const filled: Checkpoint = {
            ...checkpoint,
            channel_values: Object.fromEntries(values.filter((entry) => entry !== null)),
        }
        if (filled.v < SENDS_IN_CHECKPOINT && row.parentCheckpointId !== null) {
            await this.migrated(
                filled,
                writesAt.get(checkpointKeyOf({ ...ref, checkpointId: row.parentCheckpointId })) ?? [],
            )
        }
        const pendingWrites = await Promise.all(
            orderedWrites(writesAt.get(checkpointKeyOf(ref)) ?? []).map(
                async (write): Promise<CheckpointPendingWrite> => [
                    write.taskId,
                    write.channel,
                    await this.serde.loadsTyped(write.type, write.payload),
                ],
            ),
        )
        const tuple: CheckpointTuple = {
            config: tupleConfigOf(ref),
            checkpoint: filled,
            metadata: metadataOf(row.metadata, row.threadId),
            pendingWrites,
        }
        if (row.parentCheckpointId !== null)
            tuple.parentConfig = tupleConfigOf({ ...ref, checkpointId: row.parentCheckpointId })
        return tuple
    }

    /**
     * Moves the pending sends of the parent into a checkpoint written in a format older than the one that keeps them itself (the
     * library's own migration). A NIVO thread is never that old; the library's validation kit proves the path.
     */
    private async migrated(checkpoint: Checkpoint, parentWrites: ReadonlyArray<CheckpointWriteRow>): Promise<void> {
        const sends = orderedWrites(parentWrites.filter((write) => write.channel === TASKS))
        if (sends.length === 0) return
        checkpoint.channel_values[TASKS] = await Promise.all(
            sends.map((send) => this.serde.loadsTyped(send.type, send.payload)),
        )
        const versions = Object.values(checkpoint.channel_versions)
        checkpoint.channel_versions[TASKS] =
            versions.length > 0 ? maxChannelVersion(...versions) : this.getNextVersion(undefined)
    }
}
