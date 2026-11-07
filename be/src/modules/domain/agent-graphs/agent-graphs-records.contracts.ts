import type { GraphRoad } from "@modules/domain/authority-rules"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type {
    DecisionClosedAs,
    DecisionOutcome,
    FactValue,
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

/** A decision as its record stores it. */
export interface GraphDecisionRecord {
    /** The record. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The record version a write must still find. */
    readonly fence: string
    /** The agent. */
    readonly agentId: string
    /** The work item, or null on a run that left none. */
    readonly workItemId: string | null
    /** The road it left by. */
    readonly road: GraphRoad
    /** The mode the graph ran in. */
    readonly mode: GraphMode
    /** What the gate answered, or null. */
    readonly gateVerdict: "auto" | "ask" | null
    /** The facts a condition needed and could not read. */
    readonly unread: ReadonlyArray<string>
    /** Why the graph could not judge it, or null. */
    readonly unjudged: string | null
    /** The type of the subject, or null. */
    readonly subjectType: string | null
    /** The id of the subject, or null. */
    readonly subjectId: string | null
    /** The version that decided. */
    readonly versionId: string
    /** The wake that started the turn, or null. */
    readonly wakeId: string | null
    /** The action key. */
    readonly action: string
    /** The keys of the nodes the work went through. */
    readonly path: ReadonlyArray<string>
    /** The facts as read from real records. */
    readonly facts: Readonly<Record<string, FactValue>>
    /** The branch that matched. */
    readonly branchKey: string
    /** What the run came to. */
    readonly outcome: DecisionOutcome
    /** The approval request a branch ask opened, or null. */
    readonly approvalRequestId: string | null
    /** How the work came to an end, or null while it is open. */
    readonly closedAs: DecisionClosedAs | null
    /** True when the graph answered differently from the gate alone. */
    readonly shadowDiff: boolean
    /** When it ran. */
    readonly createdAt: Date
    /** When it last changed. */
    readonly updatedAt: Date
}
