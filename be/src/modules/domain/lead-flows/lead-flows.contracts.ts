import type { MetaPageAccess } from "@modules/integrations/meta"

/** Where a prospect stands in the lead flow; `escalated` = a person has it and the bot is silent. */
export type FlowState =
    "new" | "greeted" | "qualifying" | "scored" | "handed_off" | "nurturing" | "closed" | "escalated"

/** The score of a prospect. */
export type Level = "hot" | "warm" | "cold"

/** How a prospect touched the business. */
export type SourceKind = "leadgen" | "dm" | "comment" | "mention"

/** Facebook or Instagram. */
export type Platform = "facebook" | "instagram"

/** Why a person must take the prospect over. */
export type EscalationReason =
    "complaint" | "refund" | "angry" | "real_person" | "low_confidence" | "negative_comment" | "unreadable"

/** How the person sounded. */
export type Sentiment = "positive" | "neutral" | "negative"

/** A signal the owner's hot / warm / cold criteria are made of. */
export type Requirement =
    | "contact"
    | "need"
    | "budget_fit"
    | "timeline_soon"
    | "area_fit"
    | "asks_price_or_schedule"
    | "wants_meeting"
    | "interest_high"

/** The ad referral a conversation started from. */
export interface Referral {
    /** The ref parameter. */
    readonly ref: string | null
    /** The referral source. */
    readonly source: string | null
    /** The referral type. */
    readonly type: string | null
    /** The ad. */
    readonly ad_id: string | null
}

/** Where a touch came from: the platform, the kind of touch, and the post / ad / form / comment it hung on. */
export interface LeadSource {
    /** Facebook or Instagram. */
    readonly platform: Platform
    /** Form, message, comment or mention. */
    readonly kind: SourceKind
    /** The post commented on. */
    readonly post_id: string | null
    /** The ad. */
    readonly ad_id: string | null
    /** The lead form. */
    readonly form_id: string | null
    /** The comment. */
    readonly comment_id: string | null
    /** The Lead Ads submission. */
    readonly leadgen_id: string | null
    /** The ad referral. */
    readonly referral: Referral | null
    /** When it happened. */
    readonly at: string | null
}

/** The keys one prospect is recognised by. */
export interface Identity {
    /** The Messenger page-scoped id. */
    readonly psid: string | null
    /** The Instagram-scoped id. */
    readonly igsid: string | null
    /** The phone, normalised to 84... digits. */
    readonly phone: string | null
    /** The email, lower case. */
    readonly email: string | null
}

/** What the free text of a prospect showed. */
export interface Signals {
    /** What they want, in their words. */
    readonly need: string | null
    /** A phone number or email they shared. */
    readonly contact: string | null
    /** Whether the budget fits. */
    readonly budget: "fit" | "low" | "unknown"
    /** How soon they want it. */
    readonly timeline: "soon" | "later" | "unknown"
    /** Whether they are in the served area. */
    readonly area: "fit" | "outside" | "unknown"
    /** They asked about a price, a quote, availability or a booking. */
    readonly asks_price_or_schedule: boolean
    /** They asked to talk to or meet someone about buying. */
    readonly wants_meeting: boolean
    /** How interested they are. */
    readonly interest: "high" | "medium" | "low" | "none"
}

/** The escalation flags the model reads. */
export interface Flags {
    /** A complaint or a threat to report. */
    readonly complaint: boolean
    /** Money back or compensation. */
    readonly refund: boolean
    /** Rude, shouting or very frustrated. */
    readonly angry: boolean
    /** They asked whether this is a bot or demanded a human. */
    readonly asks_real_person: boolean
}

/** A direct question the knowledge could not answer. */
export interface TurnGap {
    /** The question. */
    readonly question: string
    /** "subject | attribute" the answer would be filed under. */
    readonly topic: string
}

/** The model's reading of one turn; `turn` is its idempotency key (one metered call per turn). */
export interface Analysis {
    /** The turn this reading belongs to. */
    readonly turn: string
    /** The signals read. */
    readonly signals: Signals
    /** The sentiment. */
    readonly sentiment: Sentiment
    /** The escalation flags. */
    readonly flags: Flags
    /** 0..1. */
    readonly confidence: number
    /** The short brand-voice reply ("" = nothing to add). */
    readonly reply: string
    /** The answer to the pending question, cleaned. */
    readonly answer: string | null
    /** A question the knowledge does not answer. */
    readonly knowledge_gap: TurnGap | null
    /** Comments: the short public reply. */
    readonly public_reply: string
    /** Comments: the private message. */
    readonly private_reply: string
}

/** One answer to one of the owner's questions. */
export interface Answer {
    /** The index of the question. */
    readonly i: number
    /** The question. */
    readonly question: string
    /** The answer. */
    readonly answer: string
    /** When it was answered. */
    readonly at: string
}

/** The hot criteria: every `all` requirement, and one of `any` when it is not empty. */
export interface HotCriteria {
    /** Every one of these. */
    readonly all: ReadonlyArray<Requirement>
    /** At least one of these. */
    readonly any: ReadonlyArray<Requirement>
}

/** The warm criteria: every `all` requirement. */
export interface WarmCriteria {
    /** Every one of these. */
    readonly all: ReadonlyArray<Requirement>
}

/** The owner's hot / warm / cold criteria as requirements. */
export interface Criteria {
    /** Hot. */
    readonly hot: HotCriteria
    /** Warm. */
    readonly warm: WarmCriteria
    /** The owner serves an area: a lead clearly outside it is cold. */
    readonly areaMatters: boolean
}

/** A score and why. */
export interface Score {
    /** Hot, warm or cold. */
    readonly level: Level
    /** Why. */
    readonly reasons: ReadonlyArray<string>
    /** What a hot score still lacks. */
    readonly missing: ReadonlyArray<Requirement>
}

/** Whether a hot lead can go to Sales: a way to reach them and a need. */
export interface HandoffReadiness {
    /** Both are known. */
    readonly ok: boolean
    /** The contact. */
    readonly contact: string | null
    /** The need. */
    readonly need: string | null
}

/** Where the 24 hour window of a person stands. */
export interface WindowStatus {
    /** open: a normal message may go; tag_only: only a person's HUMAN_AGENT message; closed: nothing. */
    readonly status: "open" | "tag_only" | "closed"
    /** Milliseconds left. */
    readonly msLeft: number
}

/** The step the state machine decided. */
export type StepKind = "escalate" | "greet" | "ask" | "ask_contact" | "handoff" | "follow_up" | "close" | "hold"

/** The decision of the state machine after a turn. */
export interface Step {
    /** What to do. */
    readonly step: StepKind
    /** The question to ask, for `ask`. */
    readonly index: number
}

/** What the state machine reads. */
export interface StepInput {
    /** The flow state. */
    readonly state: FlowState
    /** The kind of touch. */
    readonly kind: SourceKind
    /** The owner's questions. */
    readonly questions: ReadonlyArray<string>
    /** How many were asked. */
    readonly asked: number
    /** The score. */
    readonly score: Score
    /** Hot with contact and need. */
    readonly handoffOk: boolean
    /** A normal message may go now. */
    readonly canMessage: boolean
    /** A phone or email is known. */
    readonly contactKnown: boolean
    /** The contact was already asked for once. */
    readonly contactAsked: boolean
    /** The person was greeted. */
    readonly greeted: boolean
}

/** One prospect's lead flow. */
export interface LeadFlow {
    /** The id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The lead. */
    readonly lead_id: string | null
    /** The Meta connection. */
    readonly connection_id: string | null
    /** The transcript. */
    readonly conversation_id: string | null
    /** Facebook or Instagram. */
    readonly platform: Platform | null
    /** The Messenger id. */
    readonly psid: string | null
    /** The Instagram id. */
    readonly igsid: string | null
    /** The phone. */
    readonly phone: string | null
    /** The email. */
    readonly email: string | null
    /** The name. */
    readonly name: string | null
    /** The state. */
    readonly state: FlowState
    /** Where an escalated flow goes back to. */
    readonly resume_state: FlowState | null
    /** The first touch. */
    readonly source: LeadSource | null
    /** Every touch, oldest first. */
    readonly touches: ReadonlyArray<LeadSource>
    /** The answers. */
    readonly answers: ReadonlyArray<Answer>
    /** How many questions were asked. */
    readonly asked: number
    /** The question waiting for an answer. */
    readonly pending_question: number | null
    /** When the contact was asked for. */
    readonly contact_asked_at: string | null
    /** The signals so far. */
    readonly signals: Signals
    /** The score. */
    readonly score: Level | null
    /** Why. */
    readonly score_reasons: ReadonlyArray<string>
    /** When it was scored. */
    readonly scored_at: string | null
    /** The last turn's reading. */
    readonly analysis: Analysis | null
    /** When the person last wrote. */
    readonly last_user_at: string | null
    /** What they last wrote. */
    readonly last_user_text: string | null
    /** When they were greeted. */
    readonly greeted_at: string | null
    /** When they went to Sales. */
    readonly handed_off_at: string | null
    /** When they were followed up. */
    readonly followed_up_at: string | null
    /** When the flow closed. */
    readonly closed_at: string | null
    /** When a person took over. */
    readonly escalated_at: string | null
    /** Why. */
    readonly escalation_reason: string | null
}

/** The changes to one flow; every key is optional. */
export type LeadFlowPatch = Partial<MutableFlow>

/** The columns of a flow a step may change. */
export type MutableFlow = Omit<LeadFlow, "id" | "workspace_id">

/** A new flow. */
export interface NewLeadFlow {
    /** The workspace. */
    readonly workspaceId: string
    /** The lead. */
    readonly leadId: string
    /** The Meta connection. */
    readonly connectionId: string | null
    /** The platform. */
    readonly platform: Platform
    /** The identity keys. */
    readonly identity: Identity
    /** The name. */
    readonly name: string | null
    /** The first touch. */
    readonly source: LeadSource
    /** When the person last wrote, for a message. */
    readonly lastUserAt: string | null
    /** What they wrote, for a message. */
    readonly lastUserText: string | null
}

/** The owner's qualification questions and criteria (from the setup facts). */
export interface FlowSetup {
    /** At most four questions. */
    readonly questions: ReadonlyArray<string>
    /** The criteria in the owner's words (internal only). */
    readonly criteriaText: string
    /** The criteria as requirements. */
    readonly criteria: Criteria
}

/** Why a direct message did not go. */
export type DmRefusal = "window" | "tag_only" | "no_recipient" | "not_connected" | "failed"

/** What a direct message to a flow answered. */
export interface DmOutcome {
    /** Meta accepted it. */
    readonly ok: boolean
    /** Why it did not go. */
    readonly reason: DmRefusal | null
    /** The Meta failure behind `failed`. */
    readonly detail: string | null
}

/** What a reply under or to a comment answered. */
export interface CommentOutcome {
    /** Meta accepted it. */
    readonly ok: boolean
    /** The Meta failure. */
    readonly failure: string | null
    /** A private reply: the Messenger / Instagram id of the commenter it reached. */
    readonly recipientId: string | null
}

/** The texts of a turn the state machine needs the locale of. */
export interface ComposeAsk {
    /** The acknowledgement or answer first. */
    readonly reply: string
    /** The owner's question. */
    readonly question: string
    /** The thanks line used when there is no reply. */
    readonly thanks: string
}

/** What a handoff to Sales carries. */
export interface HandoffPack {
    /** The need. */
    readonly need: string | null
    /** The score. */
    readonly score: Score
    /** The answers. */
    readonly answers: ReadonlyArray<Answer>
    /** The first touch, as one line. */
    readonly sourceLine: string
    /** When the person last wrote. */
    readonly lastUserAt: string | null
    /** The labels of the lines, in the call's language. */
    readonly labels: HandoffLabels
}

/** The labels of the handoff lines. */
export interface HandoffLabels {
    /** "Answers". */
    readonly answers: string
    /** "Score". */
    readonly score: string
    /** "Source". */
    readonly source: string
    /** "Last message". */
    readonly lastMessage: string
}

/** The parts of a source line, as words in the call's language. */
export interface SourceWords {
    /** The kind of touch. */
    readonly kind: string
    /** "form". */
    readonly form: string
    /** "ad". */
    readonly ad: string
    /** "post". */
    readonly post: string
}

/** A text, or none. */
export type OptionalText = string | null

/** A flow, or none. */
export type OptionalLeadFlow = LeadFlow | null

/** The Page a connection answers through, or none. */
export type OptionalPage = MetaPageAccess | null

/** What a comment reply answered, or none when no Page could send it. */
export type OptionalCommentOutcome = CommentOutcome | null

/** The flow fields a direct message needs. */
export type DmTarget = Pick<LeadFlow, "connection_id" | "platform" | "psid" | "igsid">

/** A comment answered through a Page. */
export interface CommentTarget {
    /** The workspace the Page must belong to. */
    readonly workspaceId: string
    /** The connection of the Page. */
    readonly connectionId: string
    /** Facebook or Instagram. */
    readonly platform: Platform
    /** The comment. */
    readonly commentId: string
}

/** The text and author of an Instagram mention. */
export interface MentionRead {
    /** The text, when Meta gave it. */
    readonly text: string | null
    /** The author, when Meta gave it. */
    readonly username: string | null
}
