import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { TranscriptLine } from "@modules/domain/agent-messages"

/** The customer's message of one Telegram update. */
export interface TelegramInbound {
    /** Telegram's id of the update: the key of the delivery. */
    readonly updateId: number
    /** The Telegram chat, the customer's id on the channel. */
    readonly chatId: string
    /** The message id inside the chat. */
    readonly messageId: number
    /** What the customer wrote, or the photo label with its caption. */
    readonly text: string
    /** The name Telegram shows for the customer. */
    readonly visitor: string
    /** True for "/start": a new visit that opens with the greeting and no AI call. */
    readonly isStart: boolean
}

/** The customer's text message of one Zalo event. */
export interface ZaloInbound {
    /** The Zalo app the event was sent for; empty when the event names none. */
    readonly appId: string
    /** The customer's Zalo user id. */
    readonly userId: string
    /** Zalo's id of the message: the key of the delivery. */
    readonly messageId: string
    /** What the customer wrote. */
    readonly text: string
}

/** The customer's direct message of one Facebook or Instagram event. */
export interface MetaInbound {
    /** The platform the message came in on; it is also the conversation channel key. */
    readonly platform: "facebook" | "instagram"
    /** Page-scoped (Facebook) or Instagram-scoped id of the customer. */
    readonly personId: string
    /** The name Meta gave for the customer, when it did. */
    readonly visitor: string | null
    /** What the customer wrote. */
    readonly text: string
    /** Stable id of the event: the key of the delivery. */
    readonly eventId: string
}

/** The front-door agent bound to a connection. */
export interface FrontAgent {
    /** The agent id. */
    readonly id: string
    /** The greeting that opens a visit; may be empty. */
    readonly greeting: string
}

/** One customer turn as the runtime and the outcome handler see it. */
export interface ChatTurn {
    /** The conversation. */
    readonly conversation: TurnConversation
    /** The stored customer message this turn answers. */
    readonly messageId: string
    /** What the customer wrote in it. */
    readonly body: string
    /** The channel's own id of that message: the idempotency key of everything the turn starts. */
    readonly channelEventId: string
    /** The conversation so far, oldest first, the customer's message last. */
    readonly transcript: ReadonlyArray<TranscriptLine>
}

/** What the runtime proposes for one turn. It only proposes: the reply passes through the outcome handler before it leaves. */
export interface ChatTurnProposal {
    /** The message for the customer. */
    readonly reply: string
    /** True when the answer needs a person to approve it. */
    readonly needsHuman: boolean
    /** Why a person is needed; empty when none is. */
    readonly reason: string
    /** The answer a person could approve instead of the reply; empty when none. */
    readonly proposedAnswer: string
    /** The structured findings (lead, order, payment claim, application, loyalty, knowledge gap) the outcome handler interprets. */
    readonly detail: ProposalDetail
}

/** The structured findings of a proposal, opaque to this capability. */
export type ProposalDetail = Readonly<Record<string, unknown>>

/** The AI step's answer: a proposal, or the reason it could not answer. */
export type RuntimeAnswer = ChatTurnProposal | string

/** The AI step of a turn; the openclaw adapter implements it. */
export interface ChatTurnRuntime {
    /** Proposes the reply, or answers a text naming why it cannot (unavailable, too slow, refused). */
    propose(turn: ChatTurn): Promise<RuntimeAnswer>
}

/** What the outcome handler decided about a proposed reply. */
export interface TurnVerdict {
    /** The text to send to the customer. */
    readonly reply: string
    /** False when the reply waits for a person's approval instead of leaving now. */
    readonly send: boolean
    /** Lines to show between the messages in the workbench. */
    readonly lines: ReadonlyArray<string>
}

/** Everything a turn starts besides the reply (hand-off of the lead, order, payment check, hiring, loyalty, waiting items); the owners of those flows implement it. */
export interface CustomerOutcomes {
    /** Interprets the proposal through the authority gate and answers what leaves. It must be idempotent per `turn.channelEventId`. */
    settle(turn: ChatTurn, proposal: ChatTurnProposal): Promise<TurnVerdict>
    /** The AI could not answer: hands the question to a person and answers the lines to show. */
    holdOver(turn: ChatTurn, reason: string): Promise<ReadonlyArray<string>>
}

/** A registered AI step, or none. */
export type RegisteredRuntime = ChatTurnRuntime | undefined

/** A registered outcome handler, or none. */
export type RegisteredOutcomes = CustomerOutcomes | undefined

/** Where the owners of the AI step and of the outcomes plug into the turn. */
export interface ChatTurnExtensions {
    /** Registers the AI step; a later registration replaces an earlier one. */
    useRuntime(runtime: ChatTurnRuntime): void
    /** Registers the outcome handler; a later registration replaces an earlier one. */
    useOutcomes(outcomes: CustomerOutcomes): void
    /** The registered AI step, or undefined. */
    runtime(): RegisteredRuntime
    /** The registered outcome handler, or undefined. */
    outcomes(): RegisteredOutcomes
}
