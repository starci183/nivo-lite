import type {
    MaybeReading,
    ReadingWarning,
    SourceDetail,
    SourceRecord,
    SourceSummary,
} from "./knowledge-sources.contracts"
import type { KnowledgeSourceEntity } from "./persistence/entities"

/** A row of the document list: every column but the text, which only a single-document read carries. */
type SourceListEntity = Omit<KnowledgeSourceEntity, "content"> & { readonly content?: string }

/** A field of a stored object, or undefined. */
const field = (value: unknown, key: string): unknown =>
    typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined

/** A text field, or null. */
const textField = (value: unknown, key: string): string | null => {
    const found = field(value, key)
    return typeof found === "string" ? found : null
}

/** A whole-number field, or null. */
const countField = (value: unknown, key: string): number | null => {
    const found = field(value, key)
    return typeof found === "number" && Number.isInteger(found) ? found : null
}

/** One stored warning, or null when it is not one. */
const warningOf = (raw: unknown): ReadingWarning | null => {
    const code = textField(raw, "code")
    const message = textField(raw, "message")
    if (code === null || message === null) return null
    return { code, place: textField(raw, "place"), count: countField(raw, "count"), message }
}

/** The stored reading of a source, checked field by field; null when there is none or it is not one. */
export const readingOf = (raw: unknown): MaybeReading => {
    const reader = textField(raw, "reader")
    const readAt = textField(raw, "readAt")
    if (reader === null || readAt === null) return null
    const warnings = field(raw, "warnings")
    return {
        reader,
        pageCount: countField(raw, "pageCount"),
        sheetCount: countField(raw, "sheetCount"),
        transcribed: field(raw, "transcribed") === true,
        warnings: Array.isArray(warnings)
            ? warnings.map((item) => warningOf(item)).filter((warning): warning is ReadingWarning => warning !== null)
            : [],
        refusal: textField(raw, "refusal"),
        reason: textField(raw, "reason"),
        readAt,
        path: textField(raw, "path"),
    }
}

/** A source as the jobs read it, from the row the database answers. */
export const toSourceRecord = (row: KnowledgeSourceEntity): SourceRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    module: row.module,
    installationId: row.installationId,
    kind: row.kind,
    topic: row.topic,
    visibility: row.visibility,
    title: row.title,
    content: row.content,
    status: row.status,
    storagePath: row.storagePath,
    sourceUrl: row.sourceUrl,
    createdBy: row.createdBy,
    contentHash: row.contentHash,
    updatedAt: row.updatedAt.toISOString(),
})

/** A source as the Knowledge page lists it, from the row the database answers. */
export const toSourceSummary = (row: SourceListEntity): SourceSummary => ({
    id: row.id,
    workspaceId: row.workspaceId,
    module: row.module,
    installationId: row.installationId,
    kind: row.kind,
    topic: row.topic,
    tags: row.tags,
    visibility: row.visibility,
    title: row.title,
    status: row.status,
    error: row.error,
    chunkCount: row.chunkCount,
    sizeBytes: row.sizeBytes,
    origin: row.origin,
    progress: row.progress,
    stage: row.stage,
    stageDone: row.stageDone,
    stageTotal: row.stageTotal,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    partCount: 1,
})

/** A source with its text, from the row the database answers. */
export const toSourceDetail = (row: SourceListEntity): SourceDetail => ({
    ...toSourceSummary(row),
    content: row.content ?? "",
    reading: readingOf(row.reading),
})
