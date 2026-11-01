import type { AgentTurnPlan } from "@modules/domain/agent-work"
import type { Installation } from "@modules/domain/agents"
import type { ChatBookingRequest } from "@modules/domain/work-performers"
import type { KnowledgeSources } from "./gateway-turns.contracts"

/** The authoritative context of a turn and the knowledge found for it. */
export interface TurnSystem {
    /** The system text the agent answers under. */
    readonly text: string
    /** The knowledge the recall found for the question, as card sources; its text reaches the agent only through knowledge.search. */
    readonly sources: KnowledgeSources
}

/** The installation of an agent when it runs (none when the agent has none), or why it does not answer. */
export type InstallationOrReason = Installation | string | null

/** The plan of a customer turn on the core road, or why it cannot run. */
export type TurnPlanAnswer = AgentTurnPlan | string
/** A job application the chat captured: a job, a person, a contact and a clear consent; Hiring validates it again. */
export interface ChatApplicationProposal {
    /** The code of the job in the open jobs block. */
    readonly job: string
    /** The applicant's name. */
    readonly name: string
    /** The phone, or empty. */
    readonly phone: string
    /** The email, or empty. */
    readonly email: string
    /** Always true: an application without the applicant's clear yes is no application. */
    readonly consent: boolean
    /** When the applicant can work. */
    readonly availability: string
    /** The answers to the job's own questions. */
    readonly answers: ReadonlyArray<{ readonly questionId: string; readonly answer: string }>
}

/** A lead the customer chat captured. */
export interface CapturedLead {
    /** The contact's name. */
    readonly contactName: string
    /** The company, or empty. */
    readonly company: string
    /** What the contact needs. */
    readonly need: string
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
}

/** An order the customer clearly committed to, at a price copied from the knowledge. */
export interface CapturedOrder {
    /** The item as written in the knowledge. */
    readonly items: string
    /** The total, whole VND. */
    readonly amountVnd: number
}

/** A question the business knowledge could not answer, as the reply named it. */
export interface NamedGap {
    /** The customer's question in one short sentence. */
    readonly question: string
    /** `subject | attribute` it would be filed under. */
    readonly topic: string
}

/** Why a reply needs a person. */
export type HumanReason = "over_authority" | "unclear_outcome"

/** The structured findings of one proposed customer reply, beside the text. */
export interface ReplyFindings {
    /** The lead the customer shared, or null. */
    readonly lead: CapturedLead | null
    /** The order the customer committed to, or null. */
    readonly order: CapturedOrder | null
    /** True when the customer says they paid: a claim, never evidence. */
    readonly paymentClaim: boolean
    /** The gap the reply named, or null. */
    readonly knowledgeGap: NamedGap | null
    /** The application the reply proposed, or null; the hiring capability validates it again. */
    readonly application: ChatApplicationProposal | null
    /** The loyalty reward the customer asked to redeem, or null. */
    readonly loyaltyRewardKey: string | null
    /** The appointment request the reply named (book, change, cancel, ask what is free, wait), or null. */
    readonly bookingRequest: ChatBookingRequest | null
}

/** One proposed customer reply as the model returned it, read and bounded. */
export interface CustomerReply extends ReplyFindings {
    /** What to say to the customer. */
    readonly reply: string
    /** True when a person must look at the answer. */
    readonly needsHuman: boolean
    /** Why, or null. */
    readonly reason: HumanReason | null
    /** The answer proposed for a person to approve, or null. */
    readonly proposedAnswer: string | null
}

/** How the customer reached the business: the inbound channel key and the label a lead shows. */
export interface CustomerChannel {
    /** The inbound channel key. */
    readonly key: "website" | "telegram" | "facebook" | "instagram" | "zalo"
    /** The label shown on the lead. */
    readonly label: string
}

/** A question handed to a staff member in the Office. */
export interface Escalation {
    /** The waiting work item. */
    readonly workItemId: string
    /** The customer, when known. */
    readonly leadId: string | null
    /** The customer's name, or empty. */
    readonly customerName: string
    /** What the customer asked. */
    readonly question: string
    /** The answer the agent would give, or null. */
    readonly proposed: string | null
}

/** The customer's claim that they paid an open invoice. */
export interface PaymentClaim {
    /** The recorded payment input. */
    readonly inboundEventId: string
    /** What the customer wrote. */
    readonly claim: string
    /** The channel label. */
    readonly channelLabel: string
    /** The conversation it came from. */
    readonly conversationId: string
}

/** Whether a claim opened a new check. */
export interface ClaimStarted {
    /** True when a new reconcile_payment item was created; false when one is already open. */
    readonly created: boolean
}

/** What settling one part of a turn changed, and the lines it shows. */
export interface TurnSettled {
    /** The lines to show in the workbench. */
    readonly lines: ReadonlyArray<string>
    /** True when something new was started. */
    readonly changed: boolean
    /** The customer, as far as it is known now. */
    readonly leadId: string | null
}

/** An order a reply proposed, judged and ready to record. */
export interface OrderRequest {
    /** The reply it came with (the lead it may name). */
    readonly reply: CustomerReply
    /** The order at a known price, or null. */
    readonly order: CapturedOrder | null
    /** The channel the customer wrote on. */
    readonly channel: CustomerChannel
    /** The customer, when known. */
    readonly leadId: string | null
}

/** What the booking and loyalty parts of a turn came to: the reply that replaces the chat's own, or null, and the lines to show. */
export interface ModuleOutcome {
    /** The reply, or null to keep the chat's own. */
    readonly reply: string | null
    /** The lines the workbench shows. */
    readonly lines: ReadonlyArray<string>
}
