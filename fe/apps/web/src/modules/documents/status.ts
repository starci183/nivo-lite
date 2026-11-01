import { MODULE_KEYS, isModuleKey } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import type { KnowledgeDocument, DocumentStatus } from "@/modules/types"

/** Statuses a worker still has to move on: the live list and the Second Brain notice watch these. */
const DOCUMENT_ACTIVE_STATUSES: ReadonlySet<DocumentStatus> = new Set([
    "pending",
    "queued",
    "reading",
    "indexing",
    "extracting_facts",
])

/** Whether a worker is still on a document. */
export const isDocumentActive = (status: DocumentStatus): boolean => DOCUMENT_ACTIVE_STATUSES.has(status)

/** The tone of the badge of each status. */
export const DOCUMENT_STATUS_TONE: Readonly<Record<DocumentStatus, "neutral" | "warning" | "success" | "danger">> = {
    pending: "neutral",
    queued: "neutral",
    reading: "warning",
    indexing: "warning",
    extracting_facts: "warning",
    ready: "success",
    failed: "danger",
    blocked_credits: "warning",
}

/** The catalog key (`knowledge` namespace) of the label of each status. */
export const DOCUMENT_STATUS_KEYS: Readonly<Record<DocumentStatus, string>> = {
    pending: "status_pending",
    queued: "status_queued",
    reading: "status_reading",
    indexing: "status_indexing",
    extracting_facts: "status_extracting_facts",
    ready: "status_ready",
    failed: "status_failed",
    blocked_credits: "status_blocked_credits",
}

/** The stored code a failed or noted document carries, as the catalog key (`knowledge` namespace) that explains it. */
export const noteKeyOf = (code: string): string => `note_${code}`

/** Notes a ready document may carry: not a failure, but something the owner should know. */
const READY_NOTES: ReadonlySet<string> = new Set([
    "KNOWLEDGE_NOTE_KEYWORD_ONLY",
    "KNOWLEDGE_NOTE_NO_CREDITS_INDEX",
    "KNOWLEDGE_NOTE_NO_CREDITS_FACTS",
    "KNOWLEDGE_NOTE_FACTS_UNREAD",
    "KNOWLEDGE_NOTE_DUPLICATE",
])

/** Codes of a failure that trying again cannot clear: the file needs something done to it first. */
const FINAL_FAILURES: ReadonlySet<string> = new Set(["KNOWLEDGE_NOTE_NEEDS_OCR"])

/** Whether a stored code is a failure that trying again would only repeat. */
export const isFinalFailure = (code: string): boolean => FINAL_FAILURES.has(code)

/** Whether a stored code says the text is the same as a document the workspace already holds, so there is nothing to read again. */
export const isDuplicateNote = (code: string): boolean => code === "KNOWLEDGE_NOTE_DUPLICATE"

/** Whether a stored code is a note on a document that works, not the reason it failed. */
export const isReadyNote = (code: string): boolean => READY_NOTES.has(code)

/** The distinct topics of the documents, sorted. */
export const topicsOf = (rows: ReadonlyArray<Pick<KnowledgeDocument, "topic">>): ReadonlyArray<string> =>
    [...new Set(rows.map((row) => (row.topic ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))

/** The agents a document may be kept for. */
export const AGENT_MODULES: ReadonlyArray<ModuleKey> = [...MODULE_KEYS]

/** One agent type, by the key of the catalog. */
export type AgentModule = Extract<ModuleKey, string>

/** Whether a value is the key of an agent type. */
export const isAgentModule = (value: string): value is AgentModule => isModuleKey(value)

/** The module a filter value stands for, or "all". */
export const moduleFilterOf = (value: string | null | undefined): ModuleKey | "all" =>
    MODULE_KEYS.find((key) => key === value) ?? "all"
