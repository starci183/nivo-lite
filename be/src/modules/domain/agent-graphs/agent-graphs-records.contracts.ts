import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type {
    GraphChangeKind,
    GraphMode,
    ProposalKind,
    ProposalStatus,
} from "./agent-graphs.contracts"

/** A plain JSON object as a record stores it. */
export type PlainJson = { readonly [key: string]: JsonValue }

/** Plain JSON a record keeps without reading it: a wiring document, a patch. */
export type RecordJson = Readonly<Record<string, unknown>>

/** The graph of one agent as its record stores it; `fence` is the record version every write names. */
export interface GraphRecord {
    /** The record. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The record version a write must still find. */
    readonly fence: string
    /** The agent. */
    readonly agentId: string
    /** The installation the agent runs as. */
    readonly installationId: string
    /** The draft the editor changes, not yet parsed with the document schema. */
    readonly draft: object
    /** The revision of the draft. */
    readonly draftRev: number
    /** The version that decides, or null before the first. */
    readonly activeVersionId: string | null
    /** Whether the graph decides or only records. */
    readonly mode: GraphMode
    /** The owner who last set the mode, or null. */
    readonly modeSetBy: string | null
    /** When they did, or null. */
    readonly modeSetAt: Date | null
}

/** A graph found or made, and whether this call made it. */
export interface EnsuredGraph {
    /** The graph. */
    readonly graph: GraphRecord
    /** True when this call inserted it. */
    readonly created: boolean
}

/** One frozen version of a graph as its record stores it. */
export interface VersionRecord {
    /** The record, which is the version id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The number of the version within the agent. */
    readonly number: number
    /** The frozen graph, not yet parsed with the document schema. */
    readonly document: object
    /** The hash of the document. */
    readonly documentHash: string
    /** The context version it was published with, or null. */
    readonly contextVersionId: string | null
    /** How it came to be. */
    readonly changeKind: GraphChangeKind
    /** A note of the publisher. */
    readonly note: string
    /** Who published it, or null. */
    readonly publishedBy: string | null
    /** When it was published. */
    readonly publishedAt: Date
}

/** One indexed source of one node or branch of a version. */
export interface GraphSourceRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The version. */
    readonly versionId: string
    /** The agent. */
    readonly agentId: string
    /** The node. */
    readonly nodeKey: string
    /** The branch, or an empty text for the node itself. */
    readonly branchKey: string
    /** The kind of source. */
    readonly kind: string
    /** The reference: a fact id, a template key, a message id. */
    readonly ref: string
    /** The hash of the value the rule held when the owner confirmed it. */
    readonly valueHash: string
}

/** A proposal as its record stores it. */
export interface ProposalRecord {
    /** The record. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The record version a write must still find. */
    readonly fence: string
    /** The agent. */
    readonly agentId: string
    /** What raised it. */
    readonly kind: ProposalKind
    /** Where it stands. */
    readonly status: ProposalStatus
    /** The version it was raised against, or null. */
    readonly baseVersionId: string | null
    /** The node it is about, or null. */
    readonly nodeKey: string | null
    /** The branch it is about, or null. */
    readonly branchKey: string | null
    /** The change, as data. */
    readonly patch: RecordJson
    /** True when applying it would give the agent more reach. */
    readonly widens: boolean
    /** The evidence: decision ids, old and new passages. */
    readonly evidence: ReadonlyArray<string>
    /** When it was raised. */
    readonly createdAt: Date
}

/** A graph as `ensureGraph` writes it when the agent has none. */
export interface GraphInsert {
    /** The agent. */
    readonly agentId: string
    /** The installation the agent runs as. */
    readonly installationId: string
    /** The first draft. */
    readonly draft: PlainJson
    /** The revision of the draft. */
    readonly draftRev: number
    /** Whether the graph decides or only records. */
    readonly mode: GraphMode
}

/** The members of a graph a write changes; an absent member is left as it is. */
export interface GraphPatch {
    /** The draft. */
    readonly draft?: PlainJson
    /** The revision of the draft. */
    readonly draftRev?: number
    /** The version that decides. */
    readonly activeVersionId?: string | null
    /** Whether the graph decides or only records. */
    readonly mode?: GraphMode
    /** The owner who set the mode. */
    readonly modeSetBy?: string | null
    /** When they did (ISO text). */
    readonly modeSetAt?: string | null
}

/** A version as `insertVersion` writes it; `publishedAt` absent is the moment of the write. */
export interface VersionInsert {
    /** The agent. */
    readonly agentId: string
    /** The number of the version within the agent. */
    readonly number: number
    /** The frozen graph. */
    readonly document: PlainJson
    /** The hash of the document. */
    readonly documentHash: string
    /** The context version it was published with, or null. */
    readonly contextVersionId: string | null
    /** How it came to be. */
    readonly changeKind: GraphChangeKind
    /** A note of the publisher. */
    readonly note: string
    /** Who published it, or null. */
    readonly publishedBy: string | null
    /** When it was published (ISO text). */
    readonly publishedAt?: string
}

/** One source of a version as `insertSource` indexes it. */
export type SourceInsert = Omit<GraphSourceRecord, "workspaceId">

/** A proposal as `raiseProposal` writes it, open. */
export interface ProposalInsert {
    /** The agent. */
    readonly agentId: string
    /** The cause it is raised once for. */
    readonly dedupeKey: string
    /** What raised it. */
    readonly kind: ProposalKind
    /** The version it was raised against, or null. */
    readonly baseVersionId: string | null
    /** The node it is about, or null. */
    readonly nodeKey: string | null
    /** The branch it is about, or null. */
    readonly branchKey: string | null
    /** The change, as data. */
    readonly patch: RecordJson
    /** True when applying it would give the agent more reach. */
    readonly widens: boolean
    /** The evidence: decision ids, old and new passages. */
    readonly evidence: { readonly ids: ReadonlyArray<string> }
}

/** The members of a proposal a decision on it changes. */
export interface ProposalPatch {
    /** Where it stands. */
    readonly status?: ProposalStatus
    /** Who decided it. */
    readonly decidedBy?: string
    /** When (ISO text). */
    readonly decidedAt?: string
    /** The version its confirmation published. */
    readonly resultVersionId?: string
}

/** Which proposals of an agent a list reads: the statuses, the kind when named, and whether by status (else newest first). */
export interface ProposalStatusFilter {
    /** The agent. */
    readonly agentId: string
    /** The statuses read. */
    readonly statuses: ReadonlyArray<ProposalStatus>
    /** The kind read, or every kind. */
    readonly kind?: ProposalKind
    /** True: ordered by status then id; false: newest first. */
    readonly byStatus: boolean
}
