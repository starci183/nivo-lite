import type { ChatTranscriptLine, ChatTurnConversation } from "@modules/domain/chat-records"

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

/** A picture or file the customer sent with a message: where its bytes are, before they are read. */
export interface InboundAttachment {
    /** `image` or `file`. */
    readonly kind: "image" | "file"
    /** The https address to download the bytes from; empty for a file of a manual import. */
    readonly url: string
    /** The address of a smaller preview, or an empty text. */
    readonly thumbnailUrl: string
    /** The name the sender gave it, or an empty text. */
    readonly name: string
    /** The path of a manual import inside the import folder; empty for any other source. */
    readonly localPath: string
}

/** The customer's message of one Zalo event: text, or a picture or file with its caption. */
export interface ZaloInbound {
    /** The Zalo app the event was sent for; empty when the event names none. */
    readonly appId: string
    /** The customer's Zalo user id. */
    readonly userId: string
    /** Zalo's id of the message: the key of the delivery. */
    readonly messageId: string
    /** What the customer wrote, or the caption of the picture or file; empty when a picture came without one. */
    readonly text: string
    /** The pictures and files sent with the message; empty for a text message. */
    readonly attachments: ReadonlyArray<InboundAttachment>
    /** When the customer sent it, in epoch milliseconds, as the event says; null when the event carries no usable time. */
    readonly sentAt: number | null
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

/** A customer turn, or none when its conversation or message is gone. */
export type OptionalCustomerTurn = CustomerTurn | undefined

/** Which customer message a turn answers: what a wake carries. */
export interface TurnRef {
    /** The conversation. */
    readonly conversationId: string
    /** The stored customer message. */
    readonly messageId: string
    /** The channel's own id of that message. */
    readonly channelEventId: string
    /** The messages that arrived within the burst window and are answered by the same turn, oldest first. */
    readonly mergedMessageIds?: ReadonlyArray<string> | undefined
}

/** A stored customer message with the agent that speaks in its conversation, waiting to be answered. */
export interface CustomerIntake {
    /** The workspace. */
    readonly workspaceId: string
    /** The conversation. */
    readonly conversationId: string
    /** The stored customer message. */
    readonly messageId: string
    /** The channel's own id of the message: the idempotency key of everything the answer starts. */
    readonly channelEventId: string
    /** True when the customer was just met, so the answer should ask the channel for their name. */
    readonly lookupName: boolean
    /** The agent that answers. */
    readonly agentId: string
}

/** The front-door agent bound to a connection. */
export interface FrontAgent {
    /** The agent id. */
    readonly id: string
}

/** One customer turn as the runtime and the outcome handler see it. */
export interface CustomerTurn {
    /** The conversation. */
    readonly conversation: ChatTurnConversation
    /** The stored customer message this turn answers. */
    readonly messageId: string
    /** What the customer wrote in it. */
    readonly body: string
    /** The channel's own id of that message: the idempotency key of everything the turn starts. */
    readonly channelEventId: string
    /** The conversation so far, oldest first, the customer's message last. */
    readonly transcript: ReadonlyArray<ChatTranscriptLine>
    /** True when an output of the turn came to something: the final reply step answers, and the model's own text does not leave. */
    readonly finalOwed?: boolean
    /** The turn and wake that run it; work it opens carries it. */
    readonly origin?: TurnOrigin
}

/** The turn and the wake a piece of work came from. */
export interface TurnOrigin {
    /** The turn row. */
    readonly turnId: string
    /** The wake that started it. */
    readonly wakeId: string
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
    settle(turn: CustomerTurn, proposal: ChatTurnProposal): Promise<TurnVerdict>
    /** The AI could not answer: hands the question to a person and answers the lines to show. */
    holdOver(turn: CustomerTurn, reason: string): Promise<ReadonlyArray<string>>
    /** Puts a reply written after the turn through the same gate, keyed by what it answers. */
    settleLate(turn: CustomerTurn, reply: string, key: string): Promise<TurnVerdict>
}

/** A registered outcome handler, or none. */
export type RegisteredOutcomes = CustomerOutcomes | undefined

/** Where the outcome handler the app root plugged in is read from. */
export interface ChatTurnExtensions {
    /** The registered outcome handler, or undefined. */
    outcomes(): RegisteredOutcomes
}
