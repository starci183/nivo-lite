import type {
    DocumentPassageType,
    KnowledgeSourceTextType,
    KnowledgeSourceType,
    KnowledgeSuggestionContextType,
    ModuleInstallationType,
    NivoEntryType,
    RetrievedPassageType,
} from "@/modules/api"
import { isModuleKey } from "@/modules/catalog"
import type { Installation, InstallationStatus, OperatingMode } from "@/modules/installations"
import { installationLifecycleOf } from "@/modules/installations"
import type {
    DocumentKind,
    DocumentPassage,
    DocumentStatus,
    IdeaDecision,
    KnowledgeDocument,
    KnowledgeDocumentDetail,
    NivoEntry,
    NivoItemKind,
} from "@/modules/types"
import type { RetrievedPassage } from "./passages"

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
const INSTALLATION_STATUSES: ReadonlyArray<InstallationStatus> = [
    "installing",
    "setup",
    "ready",
    "live",
    "paused",
    "needs_connection",
]
const OPERATING_MODES: ReadonlyArray<OperatingMode> = ["assist", "autopilot"]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Whether a value is a uuid. */
export const isKnowledgeId = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

/** The status of a stored text; an unknown text is a document still waiting. */
export const toSourceStatus = (value: string): DocumentStatus => STATUSES.find((status) => status === value) ?? "queued"

/** The kind of a stored text; an unknown text is a note. */
export const toSourceKind = (value: string): DocumentKind => KINDS.find((kind) => kind === value) ?? "text"

/** The module of a stored text, or null when the document is for every module or the module is not in the catalogue. */
const moduleOf = (value: string | null): string | null => (value !== null && isModuleKey(value) ? value : null)

/** The document a `knowledgeSources` item stands for. */
export const toKnowledgeDocument = (row: KnowledgeSourceType): KnowledgeDocument => ({
    id: row.id,
    workspaceId: row.workspaceId,
    module: moduleOf(row.module ?? null),
    installationId: row.installationId ?? null,
    kind: toSourceKind(row.kind),
    topic: row.topic ?? null,
    tags: row.tags,
    visibility: row.visibility === "public" ? "public" : "internal",
    title: row.title,
    status: toSourceStatus(row.status),
    error: row.error ?? null,
    chunkCount: row.chunkCount,
    progress: row.progress,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
})

/** The document a `knowledgeSource` item stands for, with its text. */
export const toKnowledgeDocumentDetail = (row: KnowledgeSourceTextType): KnowledgeDocumentDetail => ({
    ...toKnowledgeDocument(row),
    content: row.content,
})

/** The stored passage a `knowledgeSource` chunk stands for. */
export const toDocumentPassage = (row: DocumentPassageType): DocumentPassage => ({
    id: row.id,
    ord: row.order,
    content: row.content,
    hasEmbedding: row.hasEmbedding,
})

/** The base knowledge item a `nivoKnowledge` item stands for. */
export const toNivoEntry = (row: NivoEntryType): NivoEntry => ({
    id: row.id,
    module: row.module,
    slug: row.slug,
    title: row.title,
    body: row.body,
    kind: NIVO_KINDS.find((kind) => kind === row.kind) ?? "playbook",
    version: row.version,
    updatedAt: row.updatedAt,
})

/** The passage an `askKnowledge` item stands for. */
export const toRetrievedPassage = (row: RetrievedPassageType): RetrievedPassage => ({
    key: `${row.layer}-${row.id}`,
    layer: row.layer === "nivo" ? "nivo" : "business",
    title: row.title,
    topic: row.topic ?? null,
    content: row.content,
    score: row.score,
    visibility: row.visibility === "public" ? "public" : "internal",
})

/** What the `knowledgeSuggestions` answer gives the page: the business type and the decision per suggestion key. */
export interface SuggestionContext {
    readonly businessType: string | null
    readonly states: ReadonlyMap<string, IdeaDecision>
}

const DECISIONS: ReadonlyArray<IdeaDecision> = ["dismissed", "not_applicable"]

/** The suggestion context a `knowledgeSuggestions` answer stands for. */
export const toSuggestionContext = (row: KnowledgeSuggestionContextType): SuggestionContext => ({
    businessType: row.businessType ?? null,
    states: new Map(
        row.decisions.flatMap((one): ReadonlyArray<readonly [string, IdeaDecision]> => {
            const state = DECISIONS.find((known) => known === one.state)
            return state === undefined ? [] : [[one.key, state] as const]
        }),
    ),
})

/** Whether a wire value is a plain settings object. */
const isSettings = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The installed agent a `moduleInstallations` item stands for, or null when its module is not in the catalogue. */
export const toWireInstallation = (row: ModuleInstallationType): Installation | null => {
    if (!isModuleKey(row.moduleKey)) return null
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        moduleKey: row.moduleKey,
        name: row.name,
        isMulti: row.isMulti,
        agentId: row.agentId ?? null,
        agentName: row.agentName,
        agentAvatarUrl: row.agentAvatarUrl ?? null,
        agentHandle: row.agentHandle ?? null,
        status: INSTALLATION_STATUSES.find((known) => known === row.status) ?? "setup",
        lifecycle: installationLifecycleOf(row.lifecycle),
        connectionNeeds: row.connectionNeeds,
        operatingMode: OPERATING_MODES.find((known) => known === row.operatingMode) ?? "assist",
        liveEnabled: row.liveEnabled,
        activeContextVersionId: row.activeContextVersionId ?? null,
        activeVersion: row.activeVersion ?? null,
        settings: isSettings(row.settings) ? row.settings : {},
        createdAt: row.createdAt,
    }
}
