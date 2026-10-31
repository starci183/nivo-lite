import type { RealtimeTopic } from "@modules/platform/realtime"
import type { KnowledgeProgressFrame, ProgressChange, SourceProgress, SourceStage } from "./knowledge-progress.contracts"
import type { KnowledgeSourceEntity } from "./persistence/entities"

const STAGES: ReadonlySet<string> = new Set(["read", "chunk", "embed", "store", "facts"])

const isNullableCount = (value: unknown): boolean => value === null || typeof value === "number"

const isStage = (value: unknown): value is SourceStage | null =>
    value === null || (typeof value === "string" && STAGES.has(value))

const isKnowledgeProgressFrame = (value: unknown): value is KnowledgeProgressFrame =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "kind" in value &&
    value.kind === "progress" &&
    "sourceId" in value &&
    typeof value.sourceId === "string" &&
    "status" in value &&
    typeof value.status === "string" &&
    "progress" in value &&
    typeof value.progress === "number" &&
    "stage" in value &&
    isStage(value.stage) &&
    "done" in value &&
    isNullableCount(value.done) &&
    "total" in value &&
    isNullableCount(value.total) &&
    "at" in value &&
    typeof value.at === "string"

/**
 * The progress channel of one member in one workspace. The recipient is part of the name, so a stream built from another principal
 * can never receive these frames: the publisher pushes one copy per active member and the SSE door subscribes only the caller's own
 * copy. The frames name sources, never their text.
 */
export const knowledgeProgressTopic = (
    recipientId: string,
    workspaceId: string,
): RealtimeTopic<KnowledgeProgressFrame> => ({
    name: `knowledge-progress:${recipientId}:${workspaceId.toLowerCase()}`,
    accepts: isKnowledgeProgressFrame,
})

/** The state of a source as the stream names it, from the row the database answers. */
export const progressOfRow = (
    row: Pick<
        KnowledgeSourceEntity,
        "id" | "status" | "progress" | "stage" | "stageDone" | "stageTotal" | "error" | "chunkCount" | "updatedAt"
    >,
): SourceProgress => ({
    sourceId: row.id,
    status: row.status,
    progress: row.progress,
    stage: row.stage,
    done: row.stageDone,
    total: row.stageTotal,
    error: row.error,
    chunkCount: row.chunkCount,
    at: row.updatedAt.toISOString(),
})

/** The percent of a source while its passages get their vectors: embedding fills 25 to 80. */
export const embedPercent = (done: number, total: number): number => (total <= 0 ? 25 : 25 + (55 * done) / total)

/** The columns a change writes, named as the entity names them; a field the change does not name is left out. */
export const columnsOf = (change: ProgressChange): Partial<KnowledgeSourceEntity> => ({
    ...(change.status === undefined ? {} : { status: change.status }),
    ...(change.progress === undefined ? {} : { progress: Math.max(0, Math.min(100, Math.round(change.progress))) }),
    ...(change.stage === undefined ? {} : { stage: change.stage }),
    ...(change.done === undefined ? {} : { stageDone: change.done }),
    ...(change.total === undefined ? {} : { stageTotal: change.total }),
    ...(change.error === undefined ? {} : { error: change.error }),
    ...(change.chunkCount === undefined ? {} : { chunkCount: change.chunkCount }),
})
