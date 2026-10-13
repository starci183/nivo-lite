import type { Passage } from "@modules/domain/knowledge"

/** Who an agent's view of the knowledge is for: the public view of a customer, or the team's view. */
export type KnowledgeAudience = "customer" | "internal"

/** What one agent may read of the business knowledge: the workspace, its module and instance, and the audience. */
export interface KnowledgeView {
    /** The workspace. */
    readonly workspaceId: string
    /** The module of the agent. */
    readonly module: string
    /** customer sees public knowledge only; internal sees public and internal. */
    readonly audience: KnowledgeAudience
    /** The agent instance, or null for the knowledge shared by every instance only. */
    readonly installationId: string | null
}

/** What a caller asks a view to be made from; the audience can only narrow what the module may see. */
export interface ViewRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The module of the agent. */
    readonly module: string
    /** A narrower audience: a text that leaves the business is written from the public view. */
    readonly audience?: KnowledgeAudience
    /** The agent instance. */
    readonly installationId?: string | null
}

/** What the reply of one customer turn says about the knowledge, so a gap can be noted without spending credits. */
export interface GapSignals {
    /** The gap the reply itself named, or null. */
    readonly knowledgeGap: GapClaim | null
    /** True when the reply asked for a person. */
    readonly needsHuman: boolean
    /** The answer the reply proposed for a person, or null. */
    readonly proposedAnswer: string | null
    /** True for an order, a payment claim, an application or a redeem request: a person is needed for that, not for missing knowledge. */
    readonly isTransaction: boolean
}

/** A gap the reply named. */
export interface GapClaim {
    /** The customer's question in one short sentence. */
    readonly question: string
    /** `subject | attribute` the answer would be filed under. */
    readonly topic: string
}

/** One customer turn whose gap may be noted. */
export interface GapNote {
    /** The view of the agent that answered. */
    readonly view: KnowledgeView
    /** The conversation. */
    readonly conversationId: string
    /** What the customer asked. */
    readonly question: string
    /** What the reply said. */
    readonly signals: GapSignals
}

/** Limits of one per-turn recall. */
export interface RecallLimits {
    /** How many facts at most. */
    readonly facts: number
    /** How many business passages at most. */
    readonly passages: number
    /** How many characters the block may take. */
    readonly budget: number
}

/** The brief and the passages it was made from, for the citations of a tool answer. */
export interface Recalled {
    /** The prompt block; empty when nothing matched. */
    readonly brief: string
    /** The business passages the brief quotes. */
    readonly passages: ReadonlyArray<Passage>
}
