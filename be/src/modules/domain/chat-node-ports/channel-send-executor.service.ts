import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EffectCall } from "@nivo-lite/agent-sdk/node"
import { HOLDING_LINE_KEY_PREFIX } from "@nivo-lite/agent-sdk/customer-send"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { refusalOf, type EffectFact, type EffectFacts } from "@nivo-lite/agent-sdk/node"
import {
    ChannelDeliveryService,
    ChannelsError,
    ChannelsErrorCode,
    ZALO_FREE_WINDOW_MS,
} from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import {
    ChannelDeliveriesService,
    CustomerMessagesService,
    CustomerRoutesService,
    type CustomerRoute,
    type StoredDelivery,
} from "@modules/domain/customer-routes"
import {
    GraphNodeRegistryService,
    type NodeEffectExecutor,
    type NodeEffectPayload,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import { AgentAccountsService, providerOfChannel, type RightVerdict, type SendJudged } from "@modules/domain/tools"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import {
    SEND_REFUSAL,
    channelBusy,
    outboundOf,
    placeholderRecipient,
    recipientRefused,
    sendRightOf,
    type ChannelSend,
    type ChannelVerdict,
    type CustomerMessageReceipt,
    type CustomerMessageSend,
    type SendRight,
} from "./chat-node-ports.policy"
import { LeadMemoryService, contactMemorySubjectOf } from "@modules/domain/lead-memory"
import { customerMessageSendSchema } from "./chat-node-ports.schema"
import {
    attachmentSummaryOf,
    receiptOf,
    receiptOfRow,
    reachPicked,
    windowClosedAt,
    type Reach,
    type ReceiptPlace,
} from "./customer-send.policy"
import { ChatNodePortsLogEvent } from "./chat-node-ports.log-events"
import { ChatNodePortsError, ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

/** Who is speaking: the agent answering on the route it was woken on, or the shop writing unprompted (a care step, a message to another person or channel). */
type Speech = "reply" | "proactive"

/** The kind of the fact a sent message answers. */
const MESSAGE = "message"

/**
 * What a refusal does to the delivery ledger: `fresh` claims the key and settles it refused (the message was never tried); `claimed`
 * settles a key the send already claimed.
 */
type LedgerMode = "fresh" | "claimed"

/** The reason a delivery ledger row keeps when the provider's own busy answer stopped the attempt before anything went out. */
const CHANNEL_BUSY = "channel_busy"

/** Where a send goes once the person, the channel identity and the route are settled. */
interface Addressed {
    /** The person (current id). */
    readonly contactId: string
    /** What the notice to the owner calls them. */
    readonly name: string | null
    /** The channel identity reached. */
    readonly reach: Reach
    /** The route of the person on that entrance (empty only in a check that writes nothing, for a person with no route yet). */
    readonly routeId: string
    /** Reply on the route the run was woken on, or an unprompted message. */
    readonly speech: Speech
}

/** Why a send cannot go: the refusal reason and the facts that go with it. */
interface Stop {
    readonly reason: string
    readonly facts: Readonly<Record<string, string | null>>
}

/** The send as it goes out: the words, the card and the pictures (the `images` are the caller's, ten at most by the schema). */
interface Outgoing {
    /** What the channel is given. */
    readonly send: ChannelSend
    /** The once-key. */
    readonly key: string
    /** The words as the ledger keeps them. */
    readonly text: string
}

/** The rights verdict of a send as the channel's policy reads it (`ChannelVerdict`): the right concerned is the send tool itself. */
const channelVerdictOf = (verdict: RightVerdict | null, tool: string): ChannelVerdict | null =>
    verdict === null ? null : { ...verdict, ability: tool }

/** A receipt as the facts an answer carries (undefined members left out, so the facts are plain JSON). */
const factsOf = (receipt: CustomerMessageReceipt): EffectFacts => ({
    delivered: receipt.delivered,
    state: receipt.state,
    reason: receipt.reason,
    contactId: receipt.contactId,
    channel: receipt.channel,
    accountId: receipt.accountId,
    routeId: receipt.routeId,
    providerMessageId: receipt.providerMessageId,
    ...(receipt.via === undefined ? {} : { via: receipt.via }),
    at: receipt.at,
    sendKey: receipt.sendKey,
})

@Injectable()
/**
 * The one way a step's agent says something to a customer: the executor of `nivo.tool.customer.message.send`. A message addresses a
 * PERSON: the core contact (absent: the person the run serves), on a channel and account (absent: the route the run was woken on, else
 * the person's newest channel identity). The engine resolves the contact's channel identity and the route from its own rows and reads
 * and writes NO chatbot record: every attempt is a row of the engine's delivery ledger (`ChannelDeliveriesService`: the once-key is
 * claimed before the provider is asked and settled after; a key already delivered answers its earlier receipt, one in flight or ended
 * uncertain answers `unknown` and is never sent again by a machine). The answer is the delivery RECEIPT; the node writes its own line.
 *
 * Every rule is a refusal fact the agent reads (`{ kind: "refused", id, facts }`), never a throw: no person, no channel identity, another
 * agent keeping the route, the calling agent not attached to the account, a customer who opted out of unprompted messages, no
 * reachable recipient, Zalo's window closed (read from the stored inbound messages), the plan of the connection, a channel that
 * refused, and a member of the shop holding the route (the staff hold, ruling R43: only a member's typed reply goes). Whether a person approves the message first is
 * NOT decided here: it is the node's mode, asked by the tool door at the call like every other tool (rights rule 11: the approval card,
 * then the approved call is replayed once), so a send that reaches this executor is an `auto` one or an approved one, and the engine
 * keeps no draft of it. Only an infrastructure failure throws: a channel that is not taking messages for now (quota, night hours), so the
 * run engine tries again.
 */
export class ChannelSendExecutorService implements NodeEffectExecutor, OnModuleInit {
    /** The effect it runs. */
    readonly effect: string = TOOL.customerMessageSend

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly contacts: ContactsService,
        private readonly routes: CustomerRoutesService,
        private readonly deliveries: ChannelDeliveriesService,
        private readonly delivery: ChannelDeliveryService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly accounts?: AgentAccountsService,
        @Optional() private readonly memory?: LeadMemoryService,
        @Optional() private readonly connections?: ConnectionsService,
        @Optional() private readonly lines?: CustomerMessagesService,
    ) {}

    /** Registers the executor once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /**
     * The refusal `execute` would answer for this call right now, or null when it would send: the same rules in the same order (no
     * person or identity, a member of the shop holding the route, the connection gone, an opt-out, no attachment to the account, no linked
     * recipient, Zalo's window closed), judged without writing a route, a ledger row or an audit line and without asking the provider.
     * The tool door asks it before it raises a person's approval, so nobody approves a message that cannot go. A key already answered
     * in the ledger is no refusal here (`execute` replays its receipt).
     */
    async refusalFor(turn: NodeTurn, payload: NodeEffectPayload, call: EffectCall): Promise<EffectFact | null> {
        const given = customerMessageSendSchema.safeParse(payload)
        if (!given.success) return null
        const found = await this.addressed(turn, given.data, false)
        if ("refused" in found) return found.refused
        const key = call.dedupeKey ?? call.key
        const prior = await this.deliveries.byKey(turn.workspaceId, key)
        if (prior !== null && prior.state !== "refused") return null
        const stop = await this.stopOf(turn, found, call.key.startsWith(HOLDING_LINE_KEY_PREFIX), false)
        if (stop === null) return null
        const receipt = receiptOf(placeOf(found), key, { state: "refused", reason: stop.reason })
        return { kind: "refused", id: stop.reason, facts: { ...factsOf(receipt), ...stop.facts } }
    }

    /** Says the message to the person the payload addresses; answers the delivery receipt, or why it was not sent. */
    async execute(turn: NodeTurn, payload: NodeEffectPayload, call: EffectCall): Promise<EffectFact> {
        const given = customerMessageSendSchema.safeParse(payload)
        if (!given.success) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.InvalidPayload })
        const asked = given.data
        const found = await this.addressed(turn, asked, true)
        if ("refused" in found) return this.refuse(turn, found.refused)
        const key = call.dedupeKey ?? call.key
        const prior = await this.deliveries.byKey(turn.workspaceId, key)
        if (prior !== null && prior.state !== "refused") return this.settledAnswer(turn, prior)
        const send: ChannelSend = {
            text: asked.text,
            ...(asked.order === undefined ? {} : { order: asked.order }),
            ...(asked.images === undefined || asked.images.length === 0 ? {} : { images: asked.images }),
        }
        return this.say(turn, found, { send, key, text: asked.text }, call.key.startsWith(HOLDING_LINE_KEY_PREFIX))
    }

    /**
     * The person, the channel identity and the route a payload addresses. The person is the one named, else the one the run serves (the
     * trigger's contact, else the one the woken route belongs to); the identity is picked by the channel and account named, else the
     * route the run was woken on, else the newest. The route is made when the person has none on that entrance yet (`make`; a check
     * that must write nothing only looks it up).
     */
    private async addressed(
        turn: NodeTurn,
        asked: CustomerMessageSend,
        make: boolean,
    ): Promise<Addressed | { readonly refused: EffectFact }> {
        const woken = turn.conversationId === null ? null : await this.routes.get(turn.workspaceId, turn.conversationId)
        const contactId = asked.contactId ?? turn.contactId ?? woken?.contactId ?? null
        if (contactId === null) return { refused: refusalOf(SEND_REFUSAL.noRecipient) }
        const contact = await this.contacts.get(turn.workspaceId, contactId)
        if (contact === null) return { refused: refusalOf(SEND_REFUSAL.noRecipient, { contactId }) }
        const picked = reachPicked(contact.identities, {
            channel: asked.channel,
            accountId: asked.accountId,
            woken: woken !== null && woken.contactId === contact.id ? { channel: woken.channel, accountId: woken.accountId } : null,
        })
        if (picked.kind !== "picked")
            return {
                refused: refusalOf(picked.reason, {
                    contactId: contact.id,
                    channel: asked.channel ?? null,
                    accountId: asked.accountId ?? null,
                    channels: [...picked.channels],
                }),
            }
        const { reach } = picked
        const entrance = { channel: reach.channel, accountId: reach.accountId }
        const routeId = make
            ? (await this.routes.ensure(turn.workspaceId, { contactId: contact.id, ...entrance })).routeId
            : ((await this.routes.find(turn.workspaceId, contact.id, entrance))?.id ?? "")
        return {
            contactId: contact.id,
            name: contact.displayName,
            reach,
            routeId,
            speech: routeId !== "" && this.isWoken(turn, woken, routeId) ? "reply" : "proactive",
        }
    }

    /** True when the route is the one the run was woken on. */
    private isWoken(turn: NodeTurn, woken: CustomerRoute | null, routeId: string): boolean {
        return turn.conversationId === routeId || woken?.id === routeId
    }

    /** The rules, then the claim and the push, then the receipt. */
    private async say(turn: NodeTurn, at: Addressed, out: Outgoing, engineLine: boolean): Promise<EffectFact> {
        const stop = await this.stopOf(turn, at, engineLine, true)
        if (stop !== null) return this.refusedOnRoute(turn, at, out, stop.reason, stop.facts)
        const claimed = await this.deliveries.claim(turn.workspaceId, this.claimOf(turn, at, out))
        if (claimed.verdict !== "send") return this.settledAnswer(turn, claimed.row)
        return this.pushed(turn, at, out)
    }

    /**
     * The rule that stops the send before anything is claimed, with the facts of why, or null when it may go: the one list of rules `say`
     * runs and `refusalFor` checks. `audited` files the rights verdict in the audit (a real send); a check does not.
     */
    private async stopOf(turn: NodeTurn, at: Addressed, engineLine: boolean, audited: boolean): Promise<Stop | null> {
        const rule = await this.ruleRefusal(turn, at)
        if (rule !== null) return { reason: rule, facts: {} }
        const right = await this.rightOf(turn, at, engineLine, audited)
        if (right.kind === "refused") return { reason: SEND_REFUSAL.channelNoAccess, facts: right.facts }
        if (this.unlinked(at.reach)) return { reason: SEND_REFUSAL.recipientNotLinked, facts: {} }
        if (await this.windowClosed(turn, at)) return { reason: SEND_REFUSAL.outsideWindow, facts: {} }
        return null
    }

    /**
     * The rule the send breaks before anything is claimed, or null when it may speak. The staff hold comes first (ruling R43): while a
     * member of the shop holds the route, every send that is not a member's typed reply (`turn.memberId`) is refused `route_held`, an
     * agent's step and the engine's holding line alike; the run reads the refusal as any refused send.
     */
    private async ruleRefusal(turn: NodeTurn, at: Addressed): Promise<string | null> {
        if (await this.heldFromAgents(turn, at)) return SEND_REFUSAL.routeHeld
        if (await this.connectionGone(turn, at.reach)) return SEND_REFUSAL.connectionMissing
        if (at.speech === "proactive" && (await this.optedOut(turn, at.contactId))) return SEND_REFUSAL.optedOut
        return null
    }

    /**
     * What the send may do on the identity's channel: the CALLING agent's attachment to the very account the person is reached through
     * (with two Zalo OAs, being attached to the other one is not enough), whoever's route it is (a hand-off lends the right to speak
     * there, not the attachment). The website chat goes through no provider and is no provider right. The node's mode is not judged here:
     * the tool door asked it at the call (rights rule 11), so a send that reaches this executor is an `auto` one or an approved one.
     */
    private async rightOf(turn: NodeTurn, at: Addressed, engineLine: boolean, audited: boolean): Promise<SendRight> {
        const provider = providerOfChannel(at.reach.channel)
        const { accounts } = this
        if (provider === null || accounts === undefined) return sendRightOf(null)
        const send = this.sendOf(turn, at, provider)
        const verdict = !audited
            ? await accounts.attachmentOf(send.workspaceId, send.agentId, send.effect, send.target)
            : engineLine
              ? await accounts.judgeEngineLine(send)
              : await accounts.judgeSend(send)
        return sendRightOf(channelVerdictOf(verdict, this.effect))
    }

    /** One send as the rights judge takes it: who speaks, the account reached, the turn's step, run and route. */
    private sendOf(turn: NodeTurn, at: Addressed, provider: string): SendJudged {
        return {
            workspaceId: turn.workspaceId,
            agentId: turn.agentId,
            effect: this.effect,
            target: { provider, connectionId: at.reach.accountId },
            step: turn.step,
            runId: turn.turnId,
            conversationId: at.routeId,
        }
    }

    /** Claims done: the provider is asked and the ledger settled with what it answered. */
    private async pushed(turn: NodeTurn, at: Addressed, out: Outgoing): Promise<EffectFact> {
        const { text, images } = outboundOf(out.send, at.reach.channel)
        let receipt: Awaited<ReturnType<ChannelDeliveryService["deliverToPerson"]>>
        try {
            receipt = await this.delivery.deliverToPerson({
                workspaceId: turn.workspaceId,
                routeId: at.routeId,
                channel: at.reach.channel,
                accountId: at.reach.accountId,
                userId: at.reach.userId,
                sendKey: out.key,
                text,
                windowChecked: true,
                ...(images.length === 0 ? {} : { images }),
            })
        } catch (cause) {
            // A busy token refresh sent nothing: the key is settled as refused so the run engine's retry claims it again.
            if (cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy) {
                await this.deliveries.mark(turn.workspaceId, out.key, { state: "refused", reason: CHANNEL_BUSY })
                throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.DeliveryRateLimited })
            }
            throw cause
        }
        return this.answerOfPush(turn, at, out, receipt)
    }

    /** What the provider's answer settles in the ledger (the key was claimed before the provider was asked) and the answer it makes. */
    private async answerOfPush(
        turn: NodeTurn,
        at: Addressed,
        out: Outgoing,
        receipt: Awaited<ReturnType<ChannelDeliveryService["deliverToPerson"]>>,
    ): Promise<EffectFact> {
        const place = placeOf(at)
        if (receipt.delivered) {
            const when = this.clock.now()
            await this.deliveries.mark(turn.workspaceId, out.key, { state: "delivered", providerMessageId: null, at: when })
            this.logger.info(ChatNodePortsLogEvent.Sent, { turnId: turn.turnId, sendKey: out.key, delivery: "delivered" })
            return this.message(
                receiptOf(place, out.key, { state: "delivered", reason: null, via: receipt.via, at: when.toISOString() }),
            )
        }
        if (receipt.outcome !== "rejected") {
            await this.deliveries.mark(turn.workspaceId, out.key, { state: "unknown", reason: null })
            this.logger.info(ChatNodePortsLogEvent.Sent, { turnId: turn.turnId, sendKey: out.key, delivery: "unknown" })
            return this.message(receiptOf(place, out.key, { state: "unknown", reason: "delivery_outcome_unknown" }))
        }
        const where = { failure: receipt.failure }
        if (receipt.failure === "channel_plan")
            return this.refusedOnRoute(turn, at, out, SEND_REFUSAL.planBlocked, where, "claimed")
        if (recipientRefused(receipt.failure))
            return this.refusedOnRoute(turn, at, out, SEND_REFUSAL.recipientNotLinked, where, "claimed")
        if (channelBusy(receipt.failure)) {
            this.logger.warn(ChatNodePortsLogEvent.SendFailed, { turnId: turn.turnId, reason: receipt.failure })
            await this.deliveries.mark(turn.workspaceId, out.key, { state: "refused", reason: receipt.failure ?? CHANNEL_BUSY })
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.DeliveryRateLimited })
        }
        return this.refusedOnRoute(turn, at, out, SEND_REFUSAL.notDelivered, where, "claimed")
    }

    /**
     * Refuses on a route: the refusal is a ledger row of its own (claimed and settled refused, with the words that were not told), so the
     * thread shows what was not delivered and a later try of the same key may be claimed again. `claimed` settles a key a push already
     * claimed.
     */
    private async refusedOnRoute(
        turn: NodeTurn,
        at: Addressed,
        out: Outgoing,
        reason: string,
        extra: Readonly<Record<string, string | null>>,
        ledger: LedgerMode = "fresh",
    ): Promise<EffectFact> {
        if (ledger === "fresh") {
            const claimed = await this.deliveries.claim(turn.workspaceId, this.claimOf(turn, at, out))
            if (claimed.verdict !== "send") return this.settledAnswer(turn, claimed.row)
        }
        await this.deliveries.mark(turn.workspaceId, out.key, { state: "refused", reason })
        const receipt = receiptOf(placeOf(at), out.key, { state: "refused", reason })
        return this.refuse(turn, { kind: "refused", id: reason, facts: { ...factsOf(receipt), ...extra } })
    }

    /** The answer a ledger row stands for: the same receipt however often the key is asked; a key in flight or ended uncertain is `unknown`. */
    private settledAnswer(turn: NodeTurn, row: StoredDelivery): EffectFact {
        this.logger.info(ChatNodePortsLogEvent.Sent, { turnId: turn.turnId, sendKey: row.sendKey, delivery: row.state })
        return this.message(receiptOfRow(row))
    }

    /** A message answer: the receipt is the fact. */
    private message(receipt: CustomerMessageReceipt): EffectFact {
        return { kind: MESSAGE, id: receipt.sendKey, facts: factsOf(receipt) }
    }

    /** The claim of the key: who tells what, to whom, on which route and entrance. */
    private claimOf(turn: NodeTurn, at: Addressed, out: Outgoing) {
        return {
            sendKey: out.key,
            routeId: at.routeId,
            contactId: at.contactId,
            agentId: turn.agentId,
            // A reply typed by a person (a job turn, no workflow step) has no run: only a step's send names its run.
            runId: turn.step === undefined ? null : turn.turnId,
            stepKey: turn.step?.nodeKey ?? null,
            text: out.text,
            channel: at.reach.channel,
            accountId: at.reach.accountId,
            ...attachmentSummaryOf(out.send.images),
            // The core store keeps the line whole: its pictures by address, the order card, and the member who typed it.
            files: (out.send.images ?? []).map((image) => ({
                url: image.url,
                name: "",
                contentType: "",
                ...(image.caption === undefined ? {} : { caption: image.caption }),
            })),
            ...(out.send.order === undefined ? {} : { order: { ...out.send.order } }),
            memberId: turn.memberId ?? null,
        }
    }

    /** Logs a refusal (its reason, never the words) and answers it. */
    private refuse(turn: NodeTurn, fact: EffectFact): EffectFact {
        this.logger.info(ChatNodePortsLogEvent.Refused, { turnId: turn.turnId, reason: fact.id })
        return fact
    }

    /** True when a member of the shop holds the route and this send is no member's typed reply (a route not made yet is held by nobody). */
    private async heldFromAgents(turn: NodeTurn, at: Addressed): Promise<boolean> {
        if (at.routeId === "" || (turn.memberId ?? null) !== null) return false
        return (await this.routes.holdOf(turn.workspaceId, at.routeId)) !== null
    }

    /** True when the account the person is reached through is no connection the workspace still has (the website's account is a site, no connection). */
    private async connectionGone(turn: NodeTurn, reach: Reach): Promise<boolean> {
        if (reach.channel === "website") return false
        if (reach.accountId === "") return true
        if (this.connections === undefined) return false
        return (await this.connections.find(turn.workspaceId, reach.accountId)) === null
    }

    /**
     * True when the customer asked the shop to leave them alone (`careOptOut` among the facts the consult kept in the contact's memory);
     * a shop with no memory has none.
     */
    private async optedOut(turn: NodeTurn, contactId: string): Promise<boolean> {
        if (this.memory === undefined) return false
        const snapshot = await this.memory.snapshot(turn.workspaceId, contactMemorySubjectOf(contactId, null), "step")
        return snapshot?.lead.careOptOut === true
    }

    /** True when the channel knows no recipient for the identity: no id on the channel, or an imported placeholder sender. */
    private unlinked(reach: Reach): boolean {
        return reach.userId === "" || placeholderRecipient({ channel: reach.channel, externalId: reach.userId })
    }

    /**
     * True when the customer last wrote longer ago than the free window (Zalo). The start of the window is the person's last line on the
     * route, read from the engine's own store of the conversation (`CustomerMessagesService.lastHeardAt`: only what THEY said counts, a
     * line the shop sent never opens the window); a route the person never wrote on (or none yet) is open.
     */
    private async windowClosed(turn: NodeTurn, at: Addressed): Promise<boolean> {
        if (at.reach.channel !== "zalo" || this.lines === undefined || at.routeId === "") return false
        const last = await this.lines.lastHeardAt(turn.workspaceId, at.routeId)
        return windowClosedAt(this.clock.now(), last, ZALO_FREE_WINDOW_MS)
    }
}

/** Where a message goes, for a receipt. */
const placeOf = (at: Addressed): ReceiptPlace => ({
    contactId: at.contactId,
    channel: at.reach.channel,
    accountId: at.reach.accountId,
    routeId: at.routeId,
})
