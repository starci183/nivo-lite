import { eventStreamUrl } from "@/modules/config"
import { LocalStorage, StorageId } from "@/modules/storage"
import type { EventStreamHandle } from "@starci/event-stream"
import { eventStream } from "../clients/event-stream"
import type { StreamReporter } from "../clients/event-stream"

/** The stages a worker moves a source through while it indexes it, in order. */
export type KnowledgeProgressStage = "read" | "chunk" | "embed" | "store" | "facts"

/** The state of one source the knowledge-progress stream pushes (be/src/features/realtime/knowledge-progress): the whole state of one source, never its text. */
export interface KnowledgeProgressPush {
    readonly id: string
    readonly sourceId: string
    readonly status: string
    /** 0 to 100. */
    readonly progress: number
    readonly stage: KnowledgeProgressStage | null
    /** Passages of the stage that are done, or null. */
    readonly done: number | null
    /** Passages of the stage in all, or null. */
    readonly total: number | null
    readonly error: string | null
    readonly chunkCount: number
    /** ISO 8601 time of the state; the newest state of a source wins. */
    readonly at: string
}

/** One event of the stream as the follower hands it over: the frame, or null when the event was not one. */
interface KnowledgeProgressFrame {
    readonly data: KnowledgeProgressPush | null
}

/** What following the knowledge-progress stream takes. */
interface StreamKnowledgeProgressParams {
    /** Stops the stream and its reconnects. */
    readonly signal: AbortSignal
    /** Called each time the stream (re)opens: read the stored state once, which closes the gap since the last frame. */
    readonly onOpen: () => void
    /** Called for each change of a source. */
    readonly onPush: (push: KnowledgeProgressPush) => void
    /** Called when an attempt failed and the stream will try again. */
    readonly onDrop?: () => void
    /** Where a refused or broken attempt is reported. */
    readonly report?: StreamReporter
}

const STAGES: ReadonlySet<string> = new Set(["read", "chunk", "embed", "store", "facts"])

const isCount = (value: unknown): value is number | null => value === null || typeof value === "number"

/** True when a parsed JSON value is a progress frame of the stream. */
const isPush = (value: unknown): value is KnowledgeProgressPush =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "sourceId" in value &&
    typeof value.sourceId === "string" &&
    "status" in value &&
    typeof value.status === "string" &&
    "progress" in value &&
    typeof value.progress === "number" &&
    "stage" in value &&
    (value.stage === null || (typeof value.stage === "string" && STAGES.has(value.stage))) &&
    "done" in value &&
    isCount(value.done) &&
    "total" in value &&
    isCount(value.total) &&
    "error" in value &&
    (value.error === null || typeof value.error === "string") &&
    "chunkCount" in value &&
    typeof value.chunkCount === "number" &&
    "at" in value &&
    typeof value.at === "string"

/** The progress frame of one event, or null when its data is not JSON or not a frame (the event is then ignored). */
const pushOf = (data: string): KnowledgeProgressPush | null => {
    try {
        const push: unknown = JSON.parse(data)
        return isPush(push) ? push : null
    } catch {
        return null
    }
}

/** Follows the knowledge-progress event stream of the signed-in member (`GET /realtime/knowledge-progress`) in the active workspace until the signal aborts. */
export const streamKnowledgeProgress = ({
    signal,
    onOpen,
    onPush,
    onDrop,
    report,
}: StreamKnowledgeProgressParams): EventStreamHandle => {
    const workspaceId = LocalStorage.get<string>(StorageId.ActiveWorkspaceId)
    const headers: Record<string, string> = {}
    if (workspaceId !== undefined) headers["x-workspace-id"] = workspaceId
    const handlers = {
        signal,
        headers,
        parse: pushOf,
        onOpen,
        onFrame: ({ data }: KnowledgeProgressFrame) => (data === null ? undefined : onPush(data)),
        onError: (error: Error) => {
            onDrop?.()
            report?.(`[event stream] ${error.message}`)
        },
    }
    return eventStream.follow<KnowledgeProgressPush | null>(eventStreamUrl("/realtime/knowledge-progress"), handlers)
}
