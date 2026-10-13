import type { Json } from "../../../../../../../supabase/types/database.types"
import { isModuleKey } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import type {
    KnowledgeDocument,
    NivoEntry,
    NivoItemKind,
    DocumentKind,
    DocumentStatus,
    IdeaDecision,
} from "@/modules/types"

/** The columns a document list reads: everything but the (long) text. */
export const SOURCE_COLUMNS =
    "id, workspace_id, module, installation_id, kind, topic, tags, visibility, title, status, error, chunk_count, progress, created_at, updated_at"

/** One document row as the list reads it. */
export interface SourceRow {
    readonly id: string
    readonly workspace_id: string
    readonly module: string | null
    readonly installation_id: string | null
    readonly kind: string
    readonly topic: string | null
    readonly tags: ReadonlyArray<string>
    readonly visibility: string
    readonly title: string
    readonly status: string
    readonly error: string | null
    readonly chunk_count: number
    readonly progress: number
    readonly created_at: string
    readonly updated_at: string
}

const STATUSES: ReadonlyArray<DocumentStatus> = [
    "pending",
    "queued",
    "reading",
    "indexing",
    "extracting_facts",
    "ready",
    "failed",
    "blocked_credits",
]
const KINDS: ReadonlyArray<DocumentKind> = ["text", "faq", "file", "url"]
const NIVO_KINDS: ReadonlyArray<NivoItemKind> = ["playbook", "authority", "escalation", "setup_checklist", "tone"]

/** The status of a stored text; an unknown text is a document still waiting. */
export const toSourceStatus = (value: string): DocumentStatus => STATUSES.find((status) => status === value) ?? "queued"

/** The kind of a stored text; an unknown text is a note. */
export const toSourceKind = (value: string): DocumentKind => KINDS.find((kind) => kind === value) ?? "text"

/** The kind of a stored base knowledge item; an unknown text is a playbook. */
export const toNivoKind = (value: string): NivoItemKind => NIVO_KINDS.find((kind) => kind === value) ?? "playbook"

/** The module of a stored text, or null when the document is for every module or the module is not in the catalogue. */
const moduleOf = (value: string | null): ModuleKey | null => (value !== null && isModuleKey(value) ? value : null)

/** The document a list row stands for. */
export const toSource = (row: SourceRow): KnowledgeDocument => ({
    id: row.id,
    workspaceId: row.workspace_id,
    module: moduleOf(row.module),
    installationId: row.installation_id,
    kind: toSourceKind(row.kind),
    topic: row.topic,
    tags: row.tags,
    visibility: row.visibility === "public" ? "public" : "internal",
    title: row.title,
    status: toSourceStatus(row.status),
    error: row.error,
    chunkCount: row.chunk_count,
    progress: row.progress,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
})

/** One base knowledge row as the reader selects it. */
export interface NivoRow {
    readonly id: string
    readonly module: string
    readonly slug: string
    readonly title: string
    readonly body: string
    readonly kind: string
    readonly version: number
    readonly updated_at: string
}

/** The base knowledge item a row stands for. */
export const toNivoItem = (row: NivoRow): NivoEntry => ({
    id: row.id,
    module: row.module,
    slug: row.slug,
    title: row.title,
    body: row.body,
    kind: toNivoKind(row.kind),
    version: row.version,
    updatedAt: row.updated_at,
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Whether a value is a uuid. */
export const isKnowledgeId = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

/** The kinds of command the brain and knowledge pages may ask the back end for. */
export const COMMAND_KINDS = [
    "fact.save",
    "fact.decide",
    "fact.keep",
    "lesson.save",
    "lesson.decide",
    "gap.dismiss",
    "brain.maintain",
    "lessons.mine",
    "source.delete",
    "source.reindex",
    "source.update",
    "knowledge.reembed",
    "knowledge.ask",
    "drive.linked",
    "drive.picked",
] as const

/** One kind of command. */
export type CommandKind = (typeof COMMAND_KINDS)[number]

/** A command to write, already bounded. */
export interface CommandInput {
    readonly workspaceId: string
    readonly kind: CommandKind
    readonly payload: Readonly<Record<string, Json>>
}

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether a value is plain json: text, numbers, booleans, null, lists and objects of those. */
const isJson = (value: unknown): value is Json => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return true
    if (Array.isArray(value)) return value.every(isJson)
    return isRecord(value) && Object.values(value).every((item) => item === undefined || isJson(item))
}

/** Whether a value is a plain json object. */
const isJsonObject = (value: unknown): value is Readonly<Record<string, Json>> =>
    isRecord(value) && Object.values(value).every((item) => item === undefined || isJson(item))

/** The object of a value that is a plain json object, or undefined. */
const jsonObject = (value: unknown): Readonly<Record<string, Json>> | undefined =>
    isJsonObject(value) ? value : undefined

const commandKindOf = (value: unknown): CommandKind | undefined => COMMAND_KINDS.find((kind) => kind === value)

/** Bounds a command before it reaches the database. */
export const commandSchema = {
    safeParse: (input: unknown): Parsed<CommandInput> => {
        if (!isRecord(input) || !isKnowledgeId(input.workspaceId)) return { success: false }
        const kind = commandKindOf(input.kind)
        const payload = jsonObject(input.payload)
        return kind === undefined || payload === undefined
            ? { success: false }
            : { success: true, data: { workspaceId: input.workspaceId, kind, payload } }
    },
}

/** A document to queue, already bounded. */
export interface EnqueueInput {
    readonly workspaceId: string
    readonly kind: DocumentKind
    readonly title: string
    readonly storagePath: string | null
    readonly url: string | null
    readonly meta: Readonly<Record<string, Json>>
}

/** Bounds a document to queue before it reaches the database. */
export const enqueueSchema = {
    safeParse: (input: unknown): Parsed<EnqueueInput> => {
        if (!isRecord(input) || !isKnowledgeId(input.workspaceId) || typeof input.title !== "string")
            return { success: false }
        const kind = KINDS.find((known) => known === input.kind)
        if (kind === undefined) return { success: false }
        const storagePath = typeof input.storagePath === "string" ? input.storagePath : null
        const url = typeof input.url === "string" ? input.url : null
        return {
            success: true,
            data: {
                workspaceId: input.workspaceId,
                kind,
                title: input.title.slice(0, 160),
                storagePath,
                url,
                meta: jsonObject(input.meta) ?? {},
            },
        }
    },
}

/** A decision on a suggestion, already bounded; state null brings the suggestion back. */
export interface SuggestionInput {
    readonly workspaceId: string
    readonly key: string
    readonly state: IdeaDecision | null
}

/** Bounds a suggestion decision before it reaches the database. */
export const suggestionSchema = {
    safeParse: (input: unknown): Parsed<SuggestionInput> => {
        if (!isRecord(input) || !isKnowledgeId(input.workspaceId) || typeof input.key !== "string")
            return { success: false }
        if (input.key.length < 1 || input.key.length > 60) return { success: false }
        if (input.state === null)
            return { success: true, data: { workspaceId: input.workspaceId, key: input.key, state: null } }
        if (input.state !== "dismissed" && input.state !== "not_applicable") return { success: false }
        return { success: true, data: { workspaceId: input.workspaceId, key: input.key, state: input.state } }
    },
}
