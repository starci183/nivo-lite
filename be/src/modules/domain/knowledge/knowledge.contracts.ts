import type { PassageView } from "@modules/domain/knowledge-chunks"
import type { SourceDetail } from "@modules/domain/knowledge-sources"
import type { DriveFolderListing, MaybeDriveAccess } from "@modules/integrations/documents"
import type { LlmUsage } from "@modules/integrations/llm"
import type { Outcome } from "@modules/platform/primitives"

/** Who the answer is for; `customer` only ever sees public passages. */
export type Audience = "customer" | "internal"

/** Above this many passages a document is a bulk embedding: it stops when the workspace has no credits left. */
export const BULK_CHUNKS = 40

/** How many passages one embeddings call takes. */
export const EMBED_BATCH = 32

/** How many stale passages one re-embedding batch takes. */
export const REEMBED_BATCH = 32

/** How many batches one re-embedding job does before it hands over to a follow-up job. */
export const REEMBED_MAX_BATCHES = 100

/** How a re-embedding run ended. */
export type ReembedOutcome = "done" | "more" | "blocked" | "unavailable" | "mismatch"

/** A question to try against what the agents would retrieve. */
export interface AskInput {
    /** The question. */
    readonly question: string
    /** The agent the question is asked as. */
    readonly module: string
    /** customer sees public passages only. */
    readonly audience: string
    /** The agent instance the question is asked as: its own documents join the shared ones. Absent = the shared knowledge only. */
    readonly installationId?: string | null | undefined
}

/** One retrieved passage, labelled by layer: nivo = base knowledge of NIVO, business = the owner's documents. */
export interface Passage {
    /** nivo or business. */
    readonly layer: string
    /** The passage id. */
    readonly id: string
    /** The source, for a business passage. */
    readonly sourceId: string | null
    /** The module. */
    readonly module: string | null
    /** The kind of the source or item. */
    readonly kind: string
    /** The title. */
    readonly title: string
    /** The text. */
    readonly content: string
    /** The relevance, higher first. */
    readonly score: number
    /** public or internal. */
    readonly visibility: string
    /** The topic. */
    readonly topic: string | null
    /** The order of the passage inside its document (from 0), or null for the base knowledge. */
    readonly order?: number | null
}

/** One model call to meter. */
export type UsageKind =
    "chat_reply" | "setup" | "owner_chat" | "relay" | "embedding" | "engine" | "guide" | "brain" | "office_command"

/** One model call and what it used. */
export interface UsageRecord {
    /** The workspace that pays for the call. */
    readonly workspaceId: string
    /** What the call was for. */
    readonly kind: UsageKind
    /** The module it ran for. */
    readonly module: string
    /** The model. */
    readonly model: string
    /** What the provider reported, or null when it reported nothing. */
    readonly usage: LlmUsage | null
    /** The characters sent, to estimate tokens when the provider reported none. */
    readonly promptChars?: number
    /** The characters received, to estimate tokens when the provider reported none. */
    readonly completionChars?: number
}

/** This month's use against the allowance of a workspace. */
export interface QuotaStatus {
    /** The first day of the month. */
    readonly periodStart: string
    /** Customer replies this month. */
    readonly messagesUsed: number
    /** Tokens this month. */
    readonly tokensUsed: number
    /** The reply allowance, or null for unlimited. */
    readonly messagesLimit: number | null
    /** The token allowance, or null for unlimited. */
    readonly tokensLimit: number | null
    /** Credits used this month. */
    readonly creditsUsed: number
    /** The credit allowance, or null for unlimited. */
    readonly creditsLimit: number | null
    /** Credits topped up and not yet used. */
    readonly topupBalance: number
    /** The reply allowance is used up. */
    readonly messagesExceeded: boolean
    /** The token allowance is used up. */
    readonly tokensExceeded: boolean
    /** The credit allowance and the top-ups are used up. */
    readonly creditsExceeded: boolean
    /** The largest of the used shares, 0 to 1 or more. */
    readonly ratio: number
    /** ok, warn (80% used) or exceeded. */
    readonly level: "ok" | "warn" | "exceeded"
}

/** The Google Drive access of a workspace, or nothing when it has none; a connection domain provides it. */
export interface DriveAccessSource {
    /** The access the workspace's grant gives, or null when the workspace has none. */
    forWorkspace(workspaceId: string): MaybeDriveAccess
}

/** The shape of the passages the lens may read. */
export interface Lens {
    /** The workspace. */
    readonly workspaceId: string
    /** The module. */
    readonly module: string
    /** customer or internal. */
    readonly audience: Audience
    /** The agent instance, or null for the shared knowledge only. */
    readonly installationId: string | null
}

/** What a lens is made from. */
export interface LensRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The module. */
    readonly module: string
    /** The audience the module's registry entry gives. */
    readonly moduleAudience: Audience
    /** A narrower audience the caller asks for. */
    readonly requestedAudience?: Audience
    /** The agent instance. */
    readonly installationId?: string | null | undefined
}

/** The text of a source and the better title it may bring. */
export interface ReadText {
    /** The text. */
    readonly text: string
    /** A title read from the page or file, or null to keep the title. */
    readonly title: string | null
}

/** What reading a source gave: its text, or the stored code of why it cannot be read. */
export type ReadOutcome = Outcome<ReadText, string>

/** What one run of the indexing job did with its source. */
export type IndexOutcome = "indexed" | "skipped" | "failed" | "blocked"

/** What the indexing job is told about one delivery. */
export interface IndexRun {
    /** The source to index. */
    readonly sourceId: string
    /** The workspace that owns it. */
    readonly workspaceId: string
}

/** The files of a Drive folder the owner picked, and whether Google returned nothing for it. */
export interface PickedFolder extends DriveFolderListing {
    /** True when the listing came back with no files or was refused; the owner is asked to pick the files inside. */
    readonly empty: boolean
}

/** One document with its text and its passages. */
export interface OpenedKnowledgeSource {
    /** The document with its text. */
    readonly source: SourceDetail
    /** Its passages in order. */
    readonly chunks: ReadonlyArray<PassageView>
}
