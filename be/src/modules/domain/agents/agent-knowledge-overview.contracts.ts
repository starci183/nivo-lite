/** The three layers of the shared knowledge, by who may read them. */
export type KnowledgeLayer = "public" | "internal" | "restricted"

/** What one layer of the shared knowledge holds for an agent and whether the agent reads it. */
export interface KnowledgeLayerOverview {
    /** The layer. */
    readonly layer: KnowledgeLayer
    /** Whether the view of this agent reads the layer. */
    readonly isRead: boolean
    /** How many documents the layer holds for this agent (restricted facts live in no document). */
    readonly documents: number
    /** How many facts the owner has approved in the layer. */
    readonly approvedFacts: number
    /** How many facts the layer holds, approved and waiting. */
    readonly totalFacts: number
}

/** One document that applies to this agent, whether it reads it or not. */
export interface KnowledgeDocumentOverview {
    /** The document. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The kind of source. */
    readonly kind: string
    /** The layer the document is in. */
    readonly layer: KnowledgeLayer
    /** When it last changed, ISO 8601. */
    readonly updatedAt: string
    /** Whether the view of this agent reads it. */
    readonly isRead: boolean
    /** How many facts read from it are approved. */
    readonly approvedFacts: number
    /** How many facts read from it wait for the owner. */
    readonly waitingFacts: number
}

/** One fact kept for this agent alone. */
export interface OwnFactOverview {
    /** The fact. */
    readonly id: string
    /** What it is about, as people write it. */
    readonly label: string
    /** The value with its unit. */
    readonly value: string
    /** Whether the owner approved it. */
    readonly isApproved: boolean
}

/** What the knowledge tab of one agent shows: the layers, the documents, the waiting facts and the facts only this agent reads. */
export interface AgentKnowledgeOverview {
    /** The agent. */
    readonly agentId: string
    /** The module of the agent. */
    readonly module: string
    /** The display name of the agent. */
    readonly name: string
    /** The instance the view is scoped to, or null. */
    readonly installationId: string | null
    /** Who the agent talks to. */
    readonly audience: "customer" | "internal"
    /** The facts that wait for the owner and that the agent would read once approved. */
    readonly waitingFacts: number
    /** Public, internal and restricted, in that order. */
    readonly layers: ReadonlyArray<KnowledgeLayerOverview>
    /** The documents that apply to the agent, newest change first. */
    readonly documents: ReadonlyArray<KnowledgeDocumentOverview>
    /** The facts only this agent reads. */
    readonly ownFacts: ReadonlyArray<OwnFactOverview>
}

/** What the knowledge lens answers before the agent is named: the same shape without the identity of the agent. */
export type LensOverview = Omit<AgentKnowledgeOverview, "agentId" | "name">
