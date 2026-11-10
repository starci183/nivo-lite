import type { RunnableConfig } from "@langchain/core/runnables"
import { compareWritesSortKeys, writesSortKey } from "@langchain/langgraph-checkpoint"
import { THREAD_CONFIG } from "../langgraph.port"
import type { CheckpointBlobRef, CheckpointRef, CheckpointWriteRow } from "./checkpoint-store.port"

/**
 * The key of one channel version among the values read for a list of checkpoints.
 *
 * @param ref - The channel version.
 * @returns A text that is equal for equal references.
 */
export const blobKeyOf = (ref: CheckpointBlobRef): string =>
    JSON.stringify([ref.threadId, ref.namespace, ref.channel, ref.version])

/**
 * The key of one checkpoint among the pending writes read for a list of checkpoints.
 *
 * @param ref - The checkpoint.
 * @returns A text that is equal for equal references.
 */
export const checkpointKeyOf = (ref: CheckpointRef): string =>
    JSON.stringify([ref.threadId, ref.namespace, ref.checkpointId])

/**
 * The config a tuple carries for a stored checkpoint: the three library keys and nothing else, so neither the workspace nor a
 * fence ever leaves the saver in a tuple.
 *
 * @param ref - The checkpoint.
 * @returns The config that names it.
 */
export const tupleConfigOf = (ref: CheckpointRef): RunnableConfig => ({
    configurable: {
        [THREAD_CONFIG.thread]: ref.threadId,
        checkpoint_ns: ref.namespace,
        checkpoint_id: ref.checkpointId,
    },
})

/**
 * The pending writes of one checkpoint in the order live execution applies them: task path, task id, index, compared with the
 * library's own comparator and never by the database.
 *
 * @param rows - The stored writes, in any order.
 * @returns The same writes, ordered.
 */
export const orderedWrites = (rows: ReadonlyArray<CheckpointWriteRow>): ReadonlyArray<CheckpointWriteRow> =>
    rows
        .map((row) => ({ row, key: writesSortKey(row.taskPath, row.taskId, row.idx) }))
        .toSorted((left, right) => compareWritesSortKeys(left.key, right.key))
        .map((entry) => entry.row)
