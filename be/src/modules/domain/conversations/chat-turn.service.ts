import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ChannelReceiptsService } from "@modules/domain/channel-receipts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { isChatTurnPayload } from "@modules/queues/chat-turn"
import type { ChatTurnPayload } from "@modules/queues/chat-turn"
import { InjectChatTurnExtensions } from "./conversations.decorators"
import type {
    CustomerTurn,
    ChatTurnExtensions,
    ChatTurnProposal,
    OptionalCustomerTurn,
    TurnRef,
    TurnVerdict,
} from "./conversations.contracts"
import { ConversationsLogEvent } from "./conversations.log-events"

const LOCALE = "vi"
/** A holding line goes out at most once per conversation per hour. */
const HOLDING_WINDOW_MS = 3_600_000
/** The longest holding line an owner may set. */
const HOLDING_MAX = 400
/** The name under which the engine itself holds a conversation; any other holder is a person. */
const ENGINE_ACTOR = "OpenClaw"
/** Why a turn falls back to the holding line when the AI step is missing or fails. */
const UNAVAILABLE = "openclaw_unavailable"

@Injectable()
/**
 * One customer turn on a real channel. The AI step only PROPOSES the reply; the outcome handler of the flows behind it (lead hand-off, order,
 * payment check, waiting items) decides what leaves, and the reply is stored once per customer message and delivered through the channel the
 * customer wrote on. When the AI step is missing, slow or refused, the customer gets the owner holding line (at most once per hour) and the
 * question is handed to a person. Every write is idempotent per customer message, so a redelivered job repeats nothing.
 */
export class ChatTurnService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectChatTurnExtensions() private readonly extensions: ChatTurnExtensions,
        @InjectLogger() private readonly logger: Logger,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly receipts: ChannelReceiptsService,
        private readonly delivery: ChannelDeliveryService,
        private readonly installations: InstallationRecordsService,
    ) {}

    /** Runs the job payload a worker claimed; a payload that is not a chat turn is ignored. */
    async runFromJob(payload: unknown): Promise<void> {
        if (isChatTurnPayload(payload)) await this.run(payload)
    }

    /** Runs one queued job: a turn to answer, or an already stored message to push to the customer. */
    async run(payload: ChatTurnPayload): Promise<void> {
        if (payload.kind === "deliver") {
            await this.deliverStored(payload.conversationId, payload.messageId)
            return
        }
        const turn = await this.turnOf(payload)
        if (turn === undefined || this.answeredByPerson(turn)) return
        const named = await this.ready(turn, payload.lookupName)
        const answer = await this.propose(named)
        if (typeof answer === "string") await this.holdOver(named, answer)
        else await this.respond(named, answer)
    }

    /** The customer turn a queued job or a wake names, or undefined when its conversation or message is gone. */
    async turnOf(ref: TurnRef): Promise<OptionalCustomerTurn> {
        const conversation = await this.conversations.turnOf(ref.conversationId)
        const message = await this.messages.find(ref.messageId, ref.conversationId)
        if (conversation.kind !== "ok" || message.kind !== "ok") {
            this.logger.warn(ConversationsLogEvent.TurnTargetGone, { conversationId: ref.conversationId })
            return undefined
        }
        return {
            conversation: conversation.value,
            messageId: message.value.id,
            body: message.value.body,
            channelEventId: ref.channelEventId,
            transcript: await this.messages.transcript(ref.conversationId),
        }
    }

    /** True when a person who took the conversation over answers it themselves. (The engine own hand-off still delivers the turn it was made in.) */
    answeredByPerson(turn: CustomerTurn): boolean {
        const holder = turn.conversation.handledBy
        return holder !== null && holder !== ENGINE_ACTOR
    }

    /** Names a customer just met when asked to, and shows typing on the channel; the turn is then ready for its answer. */
    async ready(turn: CustomerTurn, lookupName: boolean): Promise<CustomerTurn> {
        const named = lookupName ? await this.named(turn) : turn
        await this.delivery.showTyping(named.conversation)
        return named
    }

    private async named(turn: CustomerTurn): Promise<CustomerTurn> {
        const name = await this.delivery.customerName(turn.conversation)
        if (name === "") return turn
        await this.conversations.rename(turn.conversation.id, name)
        return { ...turn, conversation: { ...turn.conversation, visitorName: name } }
    }

    private propose(turn: CustomerTurn): Promise<ChatTurnProposal | string> {
        const runtime = this.extensions.runtime()
        if (runtime === undefined) return Promise.resolve(UNAVAILABLE)
        return runtime.propose(turn).catch((cause: unknown) => {
            this.logger.error(ConversationsLogEvent.RuntimeFailed, cause, { conversationId: turn.conversation.id })
            return UNAVAILABLE
        })
    }

    /** Puts the proposal through the outcome handler and sends what leaves, once per customer message. */
    async respond(turn: CustomerTurn, proposal: ChatTurnProposal): Promise<void> {
        const outcomes = this.extensions.outcomes()
        const verdict = outcomes === undefined ? this.plainVerdict(proposal) : await outcomes.settle(turn, proposal)
        if (verdict.send) await this.sendReply(turn, verdict.reply)
        await this.writeLines(turn.conversation, verdict.lines)
    }

    private plainVerdict(proposal: ChatTurnProposal): TurnVerdict {
        return {
            reply: proposal.reply,
            send: true,
            lines: proposal.needsHuman ? [this.catalog.get("conversations.chatNeedsHuman", {}, LOCALE)] : [],
        }
    }

    /** The AI could not answer: the question goes to a person, and the customer hears the holding line at most once per hour. */
    async holdOver(turn: CustomerTurn, reason: string): Promise<void> {
        const outcomes = this.extensions.outcomes()
        const lines = outcomes === undefined ? [] : await outcomes.holdOver(turn, reason)
        const since = new Date(this.clock.now().getTime() - HOLDING_WINDOW_MS)
        // A reply already stored for this message is a retry: finish delivering it. Otherwise one holding line per conversation per hour.
        const retry = await this.messages.replyExists(turn.conversation.id, turn.messageId)
        if (retry || !(await this.receipts.heldSince(turn.conversation.workspaceId, turn.conversation.id, since))) {
            await this.sendReply(turn, await this.holdingText(turn.conversation))
            await this.receipts.rememberHolding(turn.conversation.workspaceId, turn.conversation.id, this.clock.now())
        }
        await this.writeLines(turn.conversation, [
            this.catalog.get("conversations.chatUnavailable", {}, LOCALE),
            ...lines,
        ])
    }

    /** Stores the reply to the customer message once and pushes it to the channel unless a previous attempt already did. */
    private async sendReply(turn: CustomerTurn, text: string): Promise<void> {
        const stored = await this.messages.storeReply(
            turn.conversation.workspaceId,
            turn.conversation.id,
            text,
            turn.messageId,
        )
        if (!stored.sent)
            await this.delivery.deliver({
                conversationId: turn.conversation.id,
                messageId: stored.id,
                text: stored.body,
            })
    }

    /** The owner own words (module settings), else the default holding line. */
    private async holdingText(conversation: TurnConversation): Promise<string> {
        const installation = await this.installations.ofAgent(conversation.workspaceId, conversation.agent.id)
        const holding = installation?.settings.holdingMessage
        const custom = typeof holding === "string" ? holding.trim() : ""
        return custom === "" ? this.catalog.get("conversations.holdingReply", {}, LOCALE) : custom.slice(0, HOLDING_MAX)
    }

    private async writeLines(conversation: TurnConversation, lines: ReadonlyArray<string>): Promise<void> {
        await eachInOrder(lines, (line) => this.messages.storeLine(conversation.workspaceId, conversation.id, line))
    }

    private async deliverStored(conversationId: string, messageId: string): Promise<void> {
        const message = await this.messages.find(messageId, conversationId)
        if (message.kind !== "ok" || message.value.deliveryStatus === "sent") return
        await this.delivery.deliver({ conversationId, messageId, text: message.value.body })
    }
}
