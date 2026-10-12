import type { Locale } from "@modules/platform/i18n"

/** One message of a prompt. */
export interface ChatMessage {
    /** Who speaks. */
    readonly role: "system" | "user" | "assistant"
    /** What is said. */
    readonly content: string
}

/** The workspace and language one prompt call acts for. The workspace names the job the call belongs to. */
export interface DeepseekScope {
    /** The workspace the text is written for. */
    readonly workspaceId: string
    /** The language of the generated text. */
    readonly locale: Locale
    /** Overrides the usage kind the call is metered under. */
    readonly kind?: string
    /** Overrides the usage module the call is metered under. */
    readonly module?: string
}

/** What the text generator port takes. */
export interface TextRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** What the text is for, `<module>:<kind>`. */
    readonly purpose: string
    /** The prompt. */
    readonly messages: ReadonlyArray<ChatMessage>
    /** True when the answer must be one JSON object. */
    readonly json: boolean
    /** The usage kind. */
    readonly kind: string
    /** The usage module. */
    readonly module: string
}

/** The lead a prompt talks about. */
export interface LeadInput {
    /** The contact's name. */
    readonly contact_name: string
    /** The contact's company. */
    readonly company: string
    /** The channel the lead came through. */
    readonly channel: string
    /** What the lead needs. */
    readonly need: string
}

/** The agent a prompt speaks as. */
export interface AgentInput {
    /** The display name. */
    readonly name: string
    /** The handle. */
    readonly handle: string
    /** The role. */
    readonly role: string
    /** The owner's instructions. */
    readonly instructions: string
    /** What the agent knows about the business. */
    readonly knowledge?: string
    /** When the agent must ask for approval. */
    readonly approval_rule?: string
}

/** An agent or nothing. */
export type OptionalAgentInput = AgentInput | null

/** One turn of a chat. */
export interface ChatTurn {
    /** Who spoke. */
    readonly role: "user" | "agent"
    /** What was said. */
    readonly body: string
}

/** A lead the customer chat captured. */
export interface CapturedLead {
    /** The contact's name. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
    /** What the contact needs. */
    readonly need: string
    /** The phone. */
    readonly phone?: string | null
    /** The email. */
    readonly email?: string | null
}

/** An order the customer clearly committed to. */
export interface CapturedOrder {
    /** The item as written in the knowledge. */
    readonly items: string
    /** The price copied from the knowledge, VND. */
    readonly amount_vnd: number
}

/** A question the business knowledge could not answer. */
export interface KnowledgeGap {
    /** The customer's question. */
    readonly question: string
    /** Where it would be filed, `subject | attribute`. */
    readonly topic: string
}

/** A job application the chat captured: validated again by the hiring capability. */
export interface ChatApplication {
    /** Any field the hiring contract defines. */
    readonly [field: string]: string | number | boolean | null
}

/** A loyalty redeem request. */
export interface LoyaltyRedeem {
    /** The only intent. */
    readonly intent: "redeem"
    /** The reward key. */
    readonly reward_key: string
}

/** The structured reply the customer-facing model returns. */
export interface CustomerChatOut {
    /** What to say to the customer. */
    readonly reply: string
    /** The lead the chat captured, or null. */
    readonly lead: CapturedLead | null
    /** True when the customer asks for something outside the granted authority, or the answer is unsure. */
    readonly needs_human: boolean
    /** Why a person is needed. */
    readonly reason: "over_authority" | "unclear_outcome" | null
    /** The answer proposed for the owner to approve. */
    readonly proposed_answer: string | null
    /** The order the customer committed to. */
    readonly order: CapturedOrder | null
    /** True when the customer says they paid; a claim, never evidence. */
    readonly payment_claim: boolean
    /** The knowledge gap, when the question was not answered. */
    readonly knowledge_gap?: KnowledgeGap | null
    /** A job application. */
    readonly application?: ChatApplication | null
    /** A loyalty redeem request. */
    readonly loyalty?: LoyaltyRedeem | null
}

/** The sales classification of a lead. */
export interface Classification {
    /** The stage. */
    readonly stage: "new" | "qualified" | "proposal" | "won" | "lost"
    /** How sure the stage is, 0..1. */
    readonly confidence: number
    /** One concrete next step. */
    readonly next_action: string
    /** Information still missing. */
    readonly missing: ReadonlyArray<string>
    /** A short context brief. */
    readonly context: string
}

/** An order read from free text. */
export interface ExtractedOrder {
    /** What they order. */
    readonly items: string
    /** The total, VND, or null when none is stated. */
    readonly amount_vnd: number | null
    /** How sure the reading is, 0..1. */
    readonly confidence: number
}

/** The responsibility the model proposes for a lead. */
export interface ProposedResponsibility {
    /** The title. */
    readonly title: string
    /** Who owns it. */
    readonly owner_kind: "human" | "agent"
    /** The handle of the owning agent, or null. */
    readonly owner_handle: string | null
    /** The next action. */
    readonly next_action: string
    /** The due date, days from now. */
    readonly due_in_days: number
    /** Why this owner. */
    readonly rationale: string
}

/** The agent definition the model designs from a description. */
export interface DesignedModule {
    /** The display name. */
    readonly name: string
    /** The handle. */
    readonly handle: string
    /** The role. */
    readonly role: string
    /** The instructions. */
    readonly instructions: string
}

/** One authority rule the owner changed in chat. */
export interface AuthorityRuleChange {
    /** The action key. */
    readonly action: string
    /** The new mode, or null for unchanged. */
    readonly mode?: "auto" | "ask" | "never" | null
    /** The new limit, VND, or null for unchanged. */
    readonly limit_vnd?: number | null
}

/** The goals the owner stated. */
export interface AuthorityGoals {
    /** The revenue goal, VND. */
    readonly revenue_vnd?: number | null
    /** The new customers goal. */
    readonly new_customers?: number | null
    /** The first reply goal, minutes. */
    readonly first_reply_minutes?: number | null
    /** A free note. */
    readonly note?: string | null
}

/** What the owner granted in a chat message, as structured changes. */
export interface AuthorityChange {
    /** The goals. */
    readonly goals: AuthorityGoals
    /** New business policies. */
    readonly policies_add: ReadonlyArray<string>
    /** The reply style, or null. */
    readonly reply_style: string | null
    /** The brand voice, or null. */
    readonly brand_voice: string | null
    /** A new "always ask me when" statement, or null. */
    readonly limits_note_add: string | null
    /** The rule changes. */
    readonly rules: ReadonlyArray<AuthorityRuleChange>
    /** False when the message grants or changes nothing. */
    readonly understood: boolean
}

/** The owner's granted authority as the prompts carry it. */
export interface AuthorityInput {
    /** The business policies. */
    readonly policies: string
    /** How replies are written. */
    readonly reply_style: string
    /** The brand voice. */
    readonly brand_voice: string
    /** What the agent must always ask about first. */
    readonly limits_note: string
}

/** A prompt call's metering: the usage kind and module. */
export interface CallMeta {
    /** The usage kind. */
    readonly kind: string
    /** The usage module. */
    readonly module: string
}
