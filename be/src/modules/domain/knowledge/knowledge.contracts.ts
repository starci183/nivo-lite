import type { LocatedText, PassageView } from "@modules/domain/knowledge-chunks"
import type { SourceDetail } from "@modules/domain/knowledge-sources"
import type { DriveFolderListing, MaybeDriveAccess } from "@modules/integrations/documents"
import type { AiServed, AiUsage } from "@modules/integrations/ai"
import type { Outcome } from "@modules/platform/primitives"

/** Who the answer is for; `customer` only ever sees public passages. */
export type Audience = "customer" | "internal"

/** How many passages one embeddings call takes. */
export const EMBED_BATCH = 32

/** The fair group of a knowledge job for the queue's admission (`document:<id>`, the critique runs), or null for none. */
export type OptionalFairGroup = string | null

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

/** What an agent lane searches for, without a member asking. */
export interface AgentSearch {
    /** The workspace. */
    readonly workspaceId: string
    /** The module (agent type) whose lane is read. */
    readonly module: string
    /** customer sees public passages only. */
    readonly audience: Audience
    /** The agent instance whose own documents join the shared ones; null = the shared knowledge only. */
    readonly installationId: string | null
    /** The question. */
    readonly question: string
    /** The most passages wanted. */
    readonly limit: number
    /** How long the embedding of the question may take before the search falls back to words, milliseconds; absent = 8000. */
    readonly embedTimeoutMs?: number
    /**
     * The question already embedded by the caller with the embedding model in use (nivo.tool.brain.search embeds it for its fact half): when it
     * has EMBEDDING_DIMENSIONS numbers the search uses it and makes no embedding call of its own; absent = the search embeds it.
     */
    readonly questionVector?: ReadonlyArray<number>
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
    /** True for a business passage not released to customers yet (trust gate); its content then starts with `UNREVIEWED_MARK`. */
    readonly unreviewed?: boolean
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
    readonly usage: AiUsage | null
    /** The characters sent, to estimate tokens when the provider reported none. */
    readonly promptChars?: number
    /** The characters received, to estimate tokens when the provider reported none. */
    readonly completionChars?: number
    /**
     * Set for a FAILED try (`timeout`, `provider`, `length`, `empty`): never billed (U1). With `usage` (a try cut at its cap reports
     * it) it is booked with those real figures; without, estimated from `promptChars`. Absent for an answered call.
     */
    readonly failure?: string | undefined
    /** Which try of the call this was, from one; absent, the call's first (one record is one try). */
    readonly tryNumber?: number | undefined
    /** Which upstream served the try, why the model stopped and how long it took (`spendOf` carries it); absent when not said. */
    readonly served?: AiServed | undefined
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
    /** The stretches the text is made of with the page, slide or sheet each sits at; absent when the file names no places. */
    readonly parts?: ReadonlyArray<LocatedText>
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
