import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectCall, EffectPayload } from "@nivo-lite/agent-sdk/node"
import { TOOL, refusalOf } from "@nivo-lite/blocks-core"
import type { EffectFact, EffectFacts } from "@nivo-lite/blocks-core"
import { ChannelDeliveryService, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import type { ChatTurnConversation } from "@modules/domain/chat-records"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { ProviderAbilitiesService, providerOfChannel } from "@modules/domain/mcp-gateway"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    RECIPIENT_NOT_LINKED,
    SEND_REFUSAL,
    channelBusy,
    draftNoticeOf,
    outboundOf,
    placeholderRecipient,
    recipientLinked,
    recipientRefused,
    sendRightOf,
    verdictOf,
} from "./chat-node-ports.policy"
import type { ChannelSend, CustomerMessageSend, SendRight } from "./chat-node-ports.policy"
import { ChatLineMediaService } from "./chat-line-media.service"
import { CustomerDraftsService } from "./customer-drafts.service"
import { channelSendSchema, customerMessageSendSchema } from "./chat-node-ports.schema"
import { ChatNodePortsLogEvent } from "./chat-node-ports.log-events"
import { draftCopyOf } from "./messages/chat-node-ports.messages"
import { ChatNodePortsError, ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

/** What one push answers: delivered, or why not. */
type DeliveryReceipt = Awaited<ReturnType<ChannelDeliveryService["deliver"]>>

/** Who is speaking: the agent answering in its conversation, or the shop writing unprompted (a care step, a message addressed by the customer). */
type Speech = "reply" | "proactive"

/** The kind of the fact a sent message answers. */
const MESSAGE = "message"

/** The data kind of the customers, read for the care opt-out. */
const LEAD_KIND = "sales-lead"

@Injectable()
/**
 * The one way a step's agent says something to a customer: the executor of `customer.message.send` (a message addressed by
 * `leadId` is the shop writing unprompted, care steps included). The system, not the agent, picks the channel: the
 * conversation carries its channel and connection, and the channel layer routes by them (Zalo with its window and ZNS fallback,
 * Telegram, Meta, the website). The caller gives the words and record ids: an order becomes its card on the stored line and catalogue
 * items become pictures with the catalogue's own name and price, both built from the records.
 *
 * Every rule is a refusal fact the agent reads (`{ kind: "refused", id, facts }`), never a throw: no conversation, a conversation of
 * another run, a person or another agent holding it, the calling agent not holding the "send to customer" ability on the provider of
 * the conversation's channel, a customer who opted out of unprompted messages, no reachable recipient, Zalo's window closed, the plan
 * of the connection, a channel that refused. When that ability is ticked "ask" the message is not sent: it is stored as a draft for the owner, the owner is told in the team chat, and the call answers
 * `waits_owner` with the draft id; the same call made again once the owner approved sends it. A sent message answers
 * `{ kind: "message", id, facts: { channel, connectionId, conversationId, delivery } }`. Only an infrastructure failure throws: a
 * channel that is not taking messages for now (quota, night hours), so the run engine tries again.
 */
export class ChannelSendExecutorService implements NodeEffectExecutor, OnModuleInit {
    /** The effect it runs. */
    readonly effect: string = TOOL.customerMessageSend

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        private readonly delivery: ChannelDeliveryService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly media?: ChatLineMediaService,
        @Optional() private readonly drafts?: CustomerDraftsService,
        @Optional() private readonly abilities?: ProviderAbilitiesService,
    ) {}

    /** Registers the executor once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /** Says the message to the customer the payload addresses; answers the sent message, or why it was not sent. */
    async execute(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<EffectFact> {
        const given = customerMessageSendSchema.safeParse(payload)
        if (!given.success) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.InvalidPayload })
        const found = await this.addressed(turn, given.data)
        if ("refused" in found) return this.refuse(turn, found.refused)
        const asked = given.data
        const plain = { conversationId: found.conversation.id, text: asked.text }
        const send =
            (await this.media?.resolved(turn, {
                ...plain,
                ...(asked.orderId === undefined ? {} : { orderId: asked.orderId }),
                ...(asked.catalogueItemIds === undefined ? {} : { catalogueItemIds: asked.catalogueItemIds }),
            })) ?? plain
        const speech: Speech = "leadId" in asked || turn.conversationId === null ? "proactive" : "reply"
        return this.say(turn, found.conversation, send, call, speech)
    }

    /**
     * The same send for a message the back end composed from the records (the payment details of an order with its QR and card): the
     * pictures and the order card are the caller's, already built; the rules and the answer are those of `execute`.
     */
    async composed(turn: NodeTurn, payload: ChannelSend, call: EffectCall): Promise<EffectFact> {
        const parsed = channelSendSchema.safeParse(payload)
        if (!parsed.success) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.InvalidPayload })
        const found = await this.turnConversation(turn, parsed.data.conversationId)
        if (found === null) return this.refuse(turn, refusalOf(SEND_REFUSAL.conversationMissing))
        return this.say(turn, found, parsed.data, call, turn.conversationId === null ? "proactive" : "reply")
    }

    /** The conversation a payload addresses: the one named, or the customer's most recently active one (on the channel asked for). */
    private async addressed(
        turn: NodeTurn,
        asked: CustomerMessageSend,
    ): Promise<{ readonly conversation: ChatTurnConversation } | { readonly refused: EffectFact }> {
        if ("conversationId" in asked) {
            const found = await this.turnConversation(turn, asked.conversationId)
            return found === null ? { refused: refusalOf(SEND_REFUSAL.conversationMissing) } : { conversation: found }
        }
        const all = await this.conversations.ofLeads(turn.workspaceId, [asked.leadId])
        const picked = all.find((conversation) => asked.channel === undefined || conversation.channel === asked.channel)
        const found = picked === undefined ? null : await this.turnConversation(turn, picked.id)
        if (found !== null) return { conversation: found }
        return {
            refused: refusalOf(SEND_REFUSAL.noConversation, {
                leadId: asked.leadId,
                channel: asked.channel ?? null,
                channels: [...new Set(all.map((conversation) => conversation.channel))],
            }),
        }
    }

    /** The rules, then the draft or the store and the push, then the verdict. */
    private async say(
        turn: NodeTurn,
        conversation: ChatTurnConversation,
        send: ChannelSend,
        call: EffectCall,
        speech: Speech,
    ): Promise<EffectFact> {
        const where = factsOf(conversation)
        const refused = await this.ruleRefusal(turn, conversation, speech)
        if (refused !== null) return this.refuse(turn, refusalOf(refused, where))
        const right = await this.rightOf(turn, conversation)
        if (right.kind === "refused")
            return this.refuse(turn, refusalOf(SEND_REFUSAL.channelNoAccess, { ...where, ...right.facts }))
        const key = call.dedupeKey ?? call.key
        if (right.kind === "draft") return this.drafted(turn, conversation, send, key)
        const { text, images } = outboundOf(send, conversation.channel)
        const media = (await this.media?.of(turn, send)) ?? {}
        const stored = await this.messages.storeAgentLine({
            workspaceId: conversation.workspaceId,
            conversationId: conversation.id,
            body: text,
            key,
            sentBy: turn.agentId,
            ...media,
        })
        if (!linkedOf(conversation)) return this.keptUndelivered(turn, conversation, stored.id)
        return this.pushed(turn, conversation, stored.id, text, images)
    }

    /** The rule the send breaks before anything is stored, or null when it may speak. */
    private async ruleRefusal(
        turn: NodeTurn,
        conversation: ChatTurnConversation,
        speech: Speech,
    ): Promise<string | null> {
        if (speech === "reply" && turn.conversationId !== null && turn.conversationId !== conversation.id)
            return SEND_REFUSAL.wrongConversation
        if (conversation.handledBy !== null) return SEND_REFUSAL.heldByPerson
        if (speech === "reply" && !this.speaks(turn, conversation)) return SEND_REFUSAL.notSpeaking
        if (conversation.channel !== "website" && conversation.connectionId === null)
            return SEND_REFUSAL.connectionMissing
        if (speech === "proactive" && (await this.optedOut(turn, conversation.leadId))) return SEND_REFUSAL.optedOut
        if (
            linkedOf(conversation) &&
            conversation.channel === "zalo" &&
            (await this.windowClosed(conversation.workspaceId, conversation.id))
        )
            return SEND_REFUSAL.outsideWindow
        return null
    }

    /**
     * What the send may do on the conversation's channel: the CALLING agent's "send to customer" ability on the provider of that
     * channel, whoever's conversation it is (a hand-off lends the right to speak there, not the ability). The website chat goes
     * through no provider and is no provider right.
     */
    private async rightOf(turn: NodeTurn, conversation: ChatTurnConversation): Promise<SendRight> {
        const provider = providerOfChannel(conversation.channel)
        const verdict =
            provider === null || this.abilities === undefined
                ? null
                : await this.abilities.judge(conversation.workspaceId, turn.agentId, this.effect, false, provider)
        return sendRightOf(verdict, conversation.agent.approvalRule)
    }

    /**
     * The "ask" path: the call's draft as the owner left it. Approved, it is sent (a delivery the approval already made is not made
     * twice); turned down, the call is refused; still waiting, it waits. A call with no draft yet stores one, tells the owner in the
     * team chat, and waits.
     */
    private async drafted(
        turn: NodeTurn,
        conversation: ChatTurnConversation,
        send: ChannelSend,
        key: string,
    ): Promise<EffectFact> {
        if (this.drafts === undefined) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ProposalRefused })
        const where = factsOf(conversation)
        const known = await this.drafts.draftOf(conversation.workspaceId, key)
        if (known?.status === "posted") {
            if (!linkedOf(conversation)) return this.keptUndelivered(turn, conversation, known.id)
            const { images } = outboundOf(send, conversation.channel)
            return this.pushed(turn, conversation, known.id, known.text, images)
        }
        if (known?.status === "rejected")
            return this.refuse(turn, refusalOf(SEND_REFUSAL.ownerRejected, { ...where, draftId: known.id }))
        if (known !== null)
            return this.refuse(turn, refusalOf(SEND_REFUSAL.waitsOwner, { ...where, draftId: known.id }))
        const { text } = outboundOf(send, conversation.channel)
        const draft = await this.drafts.propose(turn, { conversationId: conversation.id, text, key })
        await this.toldOwner(turn, conversation, text, key)
        this.logger.info(ChatNodePortsLogEvent.Drafted, { turnId: turn.turnId, messageId: draft.id })
        return refusalOf(SEND_REFUSAL.waitsOwner, { ...where, draftId: draft.id })
    }

    /** Tells the owner in the team chat that a draft waits, through the team post the app registers; nothing when it registers none. */
    private async toldOwner(turn: NodeTurn, conversation: ChatTurnConversation, text: string, key: string): Promise<void> {
        const post = this.registry?.optionalExecutorOf(TOOL.teamMessagePost)
        if (post === undefined) return
        const copy = draftCopyOf(turn.locale)
        await post.execute(
            turn,
            {
                kind: "message.text",
                intent: "ask",
                title: copy.title,
                text: draftNoticeOf(copy, conversation.visitorName, text),
            },
            { key: `${key}:owner`, dedupeKey: null },
        )
    }

    /** Pushes a stored line and answers the channel's verdict. */
    private async pushed(
        turn: NodeTurn,
        conversation: ChatTurnConversation,
        messageId: string,
        text: string,
        images: ChannelSend["images"],
    ): Promise<EffectFact> {
        const receipt = await this.delivery.deliver({
            workspaceId: conversation.workspaceId,
            conversationId: conversation.id,
            messageId,
            text,
            ...(images === undefined || images.length === 0 ? {} : { images }),
        })
        if (!receipt.delivered && receipt.outcome === "rejected") return this.rejected(turn, conversation, messageId, receipt)
        const verdict = verdictOf(receipt)
        this.logger.info(ChatNodePortsLogEvent.Sent, { turnId: turn.turnId, messageId, delivery: verdict })
        return {
            kind: MESSAGE,
            id: messageId,
            facts: { ...factsOf(conversation), delivery: verdict, ...(receipt.via === undefined ? {} : { via: receipt.via }) },
        }
    }

    /** What a refused push answers: the plan, a recipient the channel cannot reach, a channel busy for now (thrown, tried again), or a plain refusal. */
    private rejected(
        turn: NodeTurn,
        conversation: ChatTurnConversation,
        messageId: string,
        receipt: DeliveryReceipt,
    ): Promise<EffectFact> | EffectFact {
        const where = { ...factsOf(conversation), messageId, delivery: verdictOf(receipt) }
        if (receipt.failure === "channel_plan") return this.refuse(turn, refusalOf(SEND_REFUSAL.planBlocked, where))
        if (recipientRefused(receipt.failure)) return this.keptUndelivered(turn, conversation, messageId)
        if (channelBusy(receipt.failure)) {
            this.logger.warn(ChatNodePortsLogEvent.SendFailed, { turnId: turn.turnId, reason: receipt.failure })
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.DeliveryRateLimited })
        }
        return this.refuse(turn, refusalOf(SEND_REFUSAL.notDelivered, { ...where, failure: receipt.failure }))
    }

    /** The message stays in the conversation for the owner to see, marked not sent for want of a recipient, and the call is refused. */
    private async keptUndelivered(
        turn: NodeTurn,
        conversation: ChatTurnConversation,
        messageId: string,
    ): Promise<EffectFact> {
        await this.messages.markDelivery(conversation.workspaceId, messageId, false, RECIPIENT_NOT_LINKED)
        this.logger.info(ChatNodePortsLogEvent.Undelivered, {
            conversationId: conversation.id,
            channel: conversation.channel,
            reason: RECIPIENT_NOT_LINKED,
        })
        return this.refuse(
            turn,
            refusalOf(SEND_REFUSAL.recipientNotLinked, {
                ...factsOf(conversation),
                messageId,
                delivery: "not_delivered",
            }),
        )
    }

    /** Logs a refusal (its reason, never the words) and answers it. */
    private refuse(turn: NodeTurn, fact: EffectFact): EffectFact {
        this.logger.info(ChatNodePortsLogEvent.Refused, { turnId: turn.turnId, reason: fact.id })
        return fact
    }

    /**
     * Whether the agent of the turn may speak in the conversation: it is the agent of the conversation, or the run was woken by a hand-off
     * that the agent of the conversation made from that very conversation. The hand-off lends the right to speak for the run; it does not
     * move the conversation.
     */
    private speaks(turn: NodeTurn, conversation: ChatTurnConversation): boolean {
        if (conversation.agent.id === turn.agentId) return true
        return turn.conversationId === conversation.id && turn.handedOffBy === conversation.agent.id
    }

    /** True when the customer asked the shop to leave them alone (`careOptOut` in what the consult kept); a shop with no customer records has none. */
    private async optedOut(turn: NodeTurn, leadId: string | null): Promise<boolean> {
        if (leadId === null || this.registry === undefined) return false
        const [lead] = await this.registry
            .portOf(LEAD_KIND)
            .read(turn, { where: { id: leadId }, fields: ["consultFacts"], limit: 1 }, "workspace")
        const facts: unknown = lead?.consultFacts
        return isRecord(facts) && facts["careOptOut"] === true
    }

    private async turnConversation(turn: NodeTurn, conversationId: string): Promise<ChatTurnConversation | null> {
        const found = await this.conversations.turnOf(turn.workspaceId, conversationId)
        return found.kind === "ok" ? found.value : null
    }

    /** True when the customer last wrote longer ago than the free window; a conversation they never wrote in is open. */
    private async windowClosed(workspaceId: string, conversationId: string): Promise<boolean> {
        const last = await this.messages.lastCustomerAt(workspaceId, conversationId)
        return last.kind === "ok" && this.clock.now().getTime() - last.value.getTime() > ZALO_FREE_WINDOW_MS
    }
}

/** Where a message goes: the facts every answer of the send carries. */
const factsOf = (conversation: ChatTurnConversation): EffectFacts => ({
    conversationId: conversation.id,
    channel: conversation.channel,
    connectionId: conversation.connectionId,
})

/** True when the channel knows the customer of the conversation. */
const linkedOf = (conversation: ChatTurnConversation): boolean =>
    recipientLinked(conversation) && !placeholderRecipient(conversation)

/** True for a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
