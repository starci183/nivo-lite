import type { Checkpoint, CheckpointMetadata } from "@langchain/langgraph-checkpoint"
import { LanggraphError, LanggraphErrorCode } from "../errors/langgraph.error"

/** The sources the library gives a checkpoint. */
const SOURCES: ReadonlySet<unknown> = new Set(["input", "loop", "update", "fork"])

/** True for an object that is not a list. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** True for a missing value or an object that is not a list. */
const isOptionalRecord = (value: unknown): boolean => value === undefined || value === null || isRecord(value)

/** True for what the library stores as a checkpoint: its format number, id, time and the version maps. */
const isCheckpoint = (value: unknown): value is Checkpoint =>
    isRecord(value) &&
    typeof value.v === "number" &&
    typeof value.id === "string" &&
    typeof value.ts === "string" &&
    isOptionalRecord(value.channel_versions) &&
    isOptionalRecord(value.versions_seen)

/** True for the source of a checkpoint's metadata. */
const isSource = (value: unknown): value is CheckpointMetadata["source"] => SOURCES.has(value)

/** Refuses a stored row that is not what the saver wrote. */
const unreadable = (threadId: string): never => {
    throw new LanggraphError({ code: LanggraphErrorCode.ThreadUnreadable, params: { thread: threadId } })
}

/**
 * Reads a stored checkpoint back as the library's shape, with no channel values: the caller fills those from the stored values.
 *
 * @param value - What the serialiser read from the row.
 * @param threadId - The thread, for the refusal.
 * @returns The checkpoint, its version maps present.
 * @throws {LanggraphError} `LANGGRAPH_THREAD_UNREADABLE` when the row is not a checkpoint.
 */
export const checkpointOf = (value: unknown, threadId: string): Checkpoint => {
    if (!isCheckpoint(value)) return unreadable(threadId)
    return {
        ...value,
        channel_values: {},
        channel_versions: value.channel_versions ?? {},
        versions_seen: value.versions_seen ?? {},
    }
}

/**
 * Reads the stored metadata of a checkpoint back as the library's shape. Every key the library or the caller wrote is kept as it is.
 *
 * @param value - The plain JSON the row holds.
 * @param threadId - The thread, for the refusal.
 * @returns The metadata.
 * @throws {LanggraphError} `LANGGRAPH_THREAD_UNREADABLE` when it carries no source or step.
 */
export const metadataOf = (value: Readonly<Record<string, unknown>>, threadId: string): CheckpointMetadata => {
    const { source, step, parents, ...rest } = value
    if (!isSource(source) || typeof step !== "number") return unreadable(threadId)
    const named = isRecord(parents)
        ? Object.entries(parents).filter((entry): entry is [string, string] => typeof entry[1] === "string")
        : []
    return { ...rest, source, step, parents: Object.fromEntries(named) }
}
