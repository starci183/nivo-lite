import { Injectable } from "@nestjs/common"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import type { ChatTurnConversation } from "@modules/domain/chat-records"
import { ChannelDeliveryService } from "@modules/domain/channels"
import type { DeliveryOutcome } from "@modules/domain/channels"
import { ChannelReceiptsService } from "@modules/domain/channel-receipts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
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
/** Why a turn is held when the agent or the workspace work is switched off: paused means silent to the customer. */
const PAUSED = "installation_not_running"

@Injectable()
/**
 * One customer turn on a real channel. The AI step only PROPOSES the reply; the outcome handler of the flows behind it (lead hand-off, order,
 * payment check, waiting items) decides what leaves, and the reply is stored once per customer message and delivered through the channel the
 * customer wrote on. When the AI step is missing, slow or refused, the customer gets the owner holding line (at most once per hour) and the
 * question is handed to a person. Every write is idempotent per customer message, so a retried wake repeats nothing.
 */
export class ChatTurnService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectChatTurnExtensions() private readonly extensions: ChatTurnExtensions,
        @InjectLogger() private readonly logger: Logger,
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        private readonly receipts: ChannelReceiptsService,
        private readonly delivery: ChannelDeliveryService,
        private readonly installations: InstallationRecordsService,
    ) {}

    /** The customer turn a wake names, or undefined when its conversation or message is gone. */
    async turnOf(workspaceId: string, ref: TurnRef): Promise<OptionalCustomerTurn> {
        const conversation = await this.conversations.turnOf(workspaceId, ref.conversationId)
        const message = await this.messages.find(workspaceId, ref.conversationId, ref.messageId)
        if (conversation.kind !== "ok" || message.kind !== "ok") {
            this.logger.warn(ConversationsLogEvent.TurnTargetGone, { conversationId: ref.conversationId })
            return undefined
        }
        const merged = await this.mergedBodies(workspaceId, ref)
        return {
            conversation: conversation.value,
            messageId: message.value.id,
            body: [message.value.body, ...merged].join("\n"),
            channelEventId: ref.channelEventId,
            transcript: await this.messages.transcript(workspaceId, ref.conversationId),
        }
    }

    /** The words of the messages that arrived within the burst window, oldest first; one that is gone is left out. */
    private async mergedBodies(workspaceId: string, ref: TurnRef): Promise<ReadonlyArray<string>> {
        const found = await Promise.all(
            (ref.mergedMessageIds ?? []).map((id) => this.messages.find(workspaceId, ref.conversationId, id)),
        )
        return found.flatMap((message) => (message.kind === "ok" ? [message.value.body] : []))
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
        await this.conversations.rename(turn.conversation.workspaceId, turn.conversation.id, name)
        return { ...turn, conversation: { ...turn.conversation, visitorName: name } }
    }

    /** Puts the proposal through the outcome handler and sends what leaves, once per customer message. */
    async respond(turn: CustomerTurn, proposal: ChatTurnProposal): Promise<void> {
        const outcomes = this.extensions.outcomes()
        const verdict = outcomes === undefined ? this.plainVerdict(proposal) : await outcomes.settle(turn, proposal)
        if (verdict.send && turn.finalOwed !== true) await this.sendReply(turn, verdict.reply)
        await this.writeLines(turn.conversation, verdict.lines)
    }

    private plainVerdict(proposal: ChatTurnProposal): TurnVerdict {
        return {
            reply: proposal.reply,
            send: true,
            lines: proposal.needsHuman ? [this.catalog.get("conversations.chatNeedsHuman", {}, LOCALE)] : [],
        }
    }

    /**
     * A reply that comes after its turn ended, keyed by what it answers: it passes the outcome handler's gate, the lines go to the
     * conversation, and the caller delivers it under that key.
     */
    async settleLate(turn: CustomerTurn, reply: string, key: string): Promise<TurnVerdict> {
        const outcomes = this.extensions.outcomes()
        if (outcomes === undefined) return { reply, send: true, lines: [] }
        const verdict = await outcomes.settleLate(turn, reply, key)
        await this.writeLines(turn.conversation, verdict.lines)
        return verdict
    }

    /**
     * The AI could not answer: the question goes to a person. The first held message of a burst (none held in the last hour) is the one that
     * marks it: the customer hears the holding line and the conversation gets one notice line; the rest of the burst only hand their question
     * to a person. A paused agent or workspace is silent to the customer unless the owner wrote a holding message of their own.
     */
    async holdOver(turn: CustomerTurn, reason: string): Promise<void> {
        const outcomes = this.extensions.outcomes()
        const lines = outcomes === undefined ? [] : await outcomes.holdOver(turn, reason)
        const since = new Date(this.clock.now().getTime() - HOLDING_WINDOW_MS)
        const fresh = !(await this.receipts.heldSince(turn.conversation.workspaceId, turn.conversation.id, since))
        // A reply already stored for this message is a retry: finish delivering it.
        const retry = await this.messages.replyExists(
            turn.conversation.workspaceId,
            turn.conversation.id,
            turn.messageId,
        )
        const words = retry || fresh ? await this.holdingText(turn.conversation, reason === PAUSED) : null
        if (words !== null) await this.sendReply(turn, words)
        if (fresh) {
            await this.receipts.rememberHolding(turn.conversation.workspaceId, turn.conversation.id, this.clock.now())
        }
        const notice = words === null ? "conversations.chatPaused" : "conversations.chatUnavailable"
        await this.writeLines(turn.conversation, [...(fresh ? [this.catalog.get(notice, {}, LOCALE)] : []), ...lines])
    }

    /** Stores the reply once and reports whether the channel accepted it, including a website's persisted reply. */
    async sendReply(turn: CustomerTurn, text: string): Promise<DeliveryOutcome> {
        const stored = await this.messages.storeAgentLine({
            workspaceId: turn.conversation.workspaceId,
            conversationId: turn.conversation.id,
            body: text,
            key: turn.messageId,
            inReplyTo: turn.messageId,
        })
        if (stored.sent) return "acknowledged"
        const result = await this.delivery.deliver({
            workspaceId: turn.conversation.workspaceId,
            conversationId: turn.conversation.id,
            messageId: stored.id,
            text: stored.body,
        })
        return result.outcome
    }

    /** The owner own words (module settings), else the default holding line; none when paused and the owner wrote none. */
    private async holdingText(conversation: ChatTurnConversation, paused: boolean): Promise<string | null> {
        const installation = await this.installations.ofAgent(conversation.workspaceId, conversation.agent.id)
        const holding = installation?.settings.holdingMessage
        const custom = typeof holding === "string" ? holding.trim() : ""
        if (custom !== "") return custom.slice(0, HOLDING_MAX)
        return paused ? null : this.catalog.get("conversations.holdingReply", {}, LOCALE)
    }

    private async writeLines(conversation: ChatTurnConversation, lines: ReadonlyArray<string>): Promise<void> {
        await eachInOrder(lines, (line) => this.messages.storeLine(conversation.workspaceId, conversation.id, line))
    }
}
