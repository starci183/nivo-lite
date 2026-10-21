import { Injectable } from "@nestjs/common"
import { AgentBindingsService, PURPOSES } from "@modules/domain/agent-connections"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { KnowledgeGapNotesService, viewOf } from "@modules/domain/agent-knowledge"
import type { CustomerTurn, ChatTurnProposal, CustomerOutcomes, TurnVerdict } from "@modules/domain/conversations"
import { CommandBusService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { HiringPublicService } from "@modules/domain/hiring"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import type { InvoiceRow } from "@modules/domain/invoices"
import { WorkItemsService } from "@modules/domain/work-items"
import type { ReasonCode } from "@modules/domain/work-items"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { handoffTranscriptOf, isRecentlyPaid, latestQuestionOf } from "./customer-turn.policy"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import type {
    CapturedOrder,
    CustomerChannel,
    CustomerReply,
    HumanReason,
    TurnSettled,
} from "./customer-turns.contracts"
import { isKnownPrice } from "./knowledge-price.policy"
import { findingsOf, humanReasonOf } from "./reply-reading.policy"
import { StaffEscalationService } from "./staff-escalation.service"
import { TurnModulesService } from "./turn-modules.service"
import { TurnPurchasesService } from "./turn-purchases.service"
import { channelKeyOf } from "./turn-prompt.policy"

/** The language of the lines a turn writes and of its work items. */
const LOCALE: Locale = "vi"
/** The name under which the engine acts in evidence and in conversation hand-offs. */
const ENGINE_ACTOR = "OpenClaw"
const SUMMARY_QUESTION_MAX = 160
/** How many queued chain steps a turn drains after it: one more when an order queued its invoice. */
const DRAIN_STEPS = 2
const DRAIN_STEPS_AFTER_ORDER = 3

/** What a chat application came to: the reply that leaves, the lines to show, and whether it was stored. */
interface AppliedApplication {
    /** The reply, replaced when the application was refused. */
    readonly reply: string
    /** The lines to show. */
    readonly lines: ReadonlyArray<string>
    /** True when the application was stored. */
    readonly changed: boolean
}

/** A waiting answer to open for a person. */
interface ReplyItemSpec {
    /** One item per customer message and purpose. */
    readonly dedupeKey: string
    /** What the customer asked. */
    readonly question: string
    /** The answer a person may approve, or empty. */
    readonly draft: string
    /** Why a person decides. */
    readonly forceAsk: ReasonCode
    /** The customer, when known. */
    readonly leadId: string | null
}

/** A waiting answer, and whether an earlier delivery of the turn had already opened it. */
interface OpenedReplyItem {
    /** The item. */
    readonly item: WorkItem
    /** True when it existed before this call. */
    readonly existed: boolean
}

/** The reply as the gate will judge it, after the price and payment rules. */
interface Judged {
    /** The text that leaves. */
    readonly reply: string
    /** True when a person must answer. */
    readonly needsHuman: boolean
    /** Why, or null. */
    readonly reason: HumanReason | null
    /** The order to record, or null. */
    readonly order: CapturedOrder | null
    /** The open invoice the customer says they paid, or null. */
    readonly claimOpen: InvoiceRow | null
}

@Injectable()
/**
 * Everything a customer turn starts besides the reply, through the owner's authority gate: the lead hand-off to Sales, the order (at a
 * price written in the knowledge only), the payment claim (never evidence: one check per invoice that waits for the owner), the chat
 * application, the waiting answer with a staff member tagged, and the knowledge gap. Every effect is idempotent per channel message.
 */
export class CustomerOutcomesService implements CustomerOutcomes {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly engine: WorkEngineService,
        private readonly bus: CommandBusService,
        private readonly evidence: EvidenceService,
        private readonly items: WorkItemsService,
        private readonly inbound: InboundEventsService,
        private readonly invoices: InvoicesService,
        private readonly conversations: AgentConversationsService,
        private readonly bindings: AgentBindingsService,
        private readonly hiring: HiringPublicService,
        private readonly purchases: TurnPurchasesService,
        private readonly staff: StaffEscalationService,
        private readonly gaps: KnowledgeGapNotesService,
        private readonly modules: TurnModulesService,
    ) {}

    /** Interprets the proposed reply through the gate and answers what leaves and which lines the workbench shows. */
    async settle(turn: CustomerTurn, proposal: ChatTurnProposal): Promise<TurnVerdict> {
        const ctx = this.ctxOf(turn)
        const reply: CustomerReply = {
            reply: proposal.reply,
            needsHuman: proposal.needsHuman,
            reason: humanReasonOf(proposal.reason, proposal.needsHuman),
            proposedAnswer: proposal.proposedAnswer.trim() === "" ? null : proposal.proposedAnswer,
            ...findingsOf(proposal.detail),
        }
        const judged = await this.judge(turn.conversation, reply)
        const application = await this.applyApplication(turn, reply, judged.reply)
        const approval = await this.approvalOf(ctx, turn, application.reply)
        const channel = this.channelOf(turn.conversation)
        const handoff = await this.handOff(ctx, turn, reply, application.reply, channel)
        const order = await this.purchases.recordOrder(ctx, turn, {
            reply,
            order: judged.order,
            channel,
            leadId: handoff.leadId,
        })
        const claim = await this.purchases.recordClaim(ctx, turn, judged.claimOpen, channel)
        const extra = judged.needsHuman ? { reply: null, lines: [] } : await this.modules.settle(ctx, turn, reply)
        const waiting = judged.needsHuman ? await this.askPerson(ctx, turn, reply, judged, order.leadId) : []
        await this.gaps.note({
            view: viewOf({
                workspaceId: ctx.workspaceId,
                module: turn.conversation.agent.module,
                audience: "customer",
                installationId: turn.conversation.installationId,
            }),
            conversationId: turn.conversation.id,
            question: turn.body,
            signals: {
                knowledgeGap: reply.knowledgeGap,
                needsHuman: reply.needsHuman,
                proposedAnswer: reply.proposedAnswer,
                isTransaction:
                    reply.order !== null ||
                    reply.paymentClaim ||
                    reply.application !== null ||
                    reply.loyaltyRewardKey !== null,
            },
        })
        const changed =
            handoff.changed ||
            order.changed ||
            claim.changed ||
            application.changed ||
            waiting.length > 0 ||
            extra.lines.length > 0 ||
            judged.needsHuman
        if (changed) this.drainLater(ctx, order.changed ? DRAIN_STEPS_AFTER_ORDER : DRAIN_STEPS)
        return {
            reply: extra.reply ?? application.reply,
            send: approval.length === 0,
            lines: [
                ...approval,
                ...application.lines,
                ...handoff.lines,
                ...order.lines,
                ...claim.lines,
                ...extra.lines,
                ...waiting,
            ],
        }
    }

    /** The AI could not answer: the question becomes a waiting answer for a person, tagged to a staff member, with the fallback in the evidence. */
    async holdOver(turn: CustomerTurn, reason: string): Promise<ReadonlyArray<string>> {
        const ctx = this.ctxOf(turn)
        const { conversation } = turn
        const { item, existed } = await this.openReplyItem(ctx, conversation, {
            dedupeKey: `reply_customer:message:${turn.messageId}`,
            question: turn.body,
            draft: "",
            forceAsk: "unclear_outcome",
            leadId: conversation.leadId,
        })
        if (!existed) {
            if (item.status === "waiting_decision") await this.escalate(item, conversation, turn.body, null)
            await this.evidence.log(ctx, {
                lead_id: conversation.leadId,
                kind: "engine.fallback",
                actor: ENGINE_ACTOR,
                summary: this.text("fallbackEvidence", { reason }),
                evidence: turn.messageId,
            })
            this.drainLater(ctx, DRAIN_STEPS)
        }
        return []
    }

    /** The price and payment rules: an order only at a price the owner wrote, and "I have paid" answered with fixed text. */
    private async judge(conversation: TurnConversation, reply: CustomerReply): Promise<Judged> {
        const asked = reply.paymentClaim ? null : reply.order
        const knownPrice = asked === null || isKnownPrice(conversation.agent.knowledge, asked.amountVnd)
        const base: Judged = knownPrice
            ? { reply: reply.reply, needsHuman: reply.needsHuman, reason: reply.reason, order: asked, claimOpen: null }
            : {
                  reply: this.text("orderPriceUnknownReply", {}),
                  needsHuman: true,
                  reason: "over_authority",
                  order: null,
                  claimOpen: null,
              }
        if (!reply.paymentClaim) return base
        const leadId = conversation.leadId
        const claimOpen =
            leadId === null ? null : await this.invoices.latestOfLead(conversation.workspaceId, leadId, "issued")
        if (claimOpen !== null) {
            return {
                ...base,
                reply: this.text("paymentClaimReply", { no: claimOpen.invoice_no }),
                needsHuman: false,
                claimOpen,
            }
        }
        const paid = leadId === null ? null : await this.invoices.latestOfLead(conversation.workspaceId, leadId, "paid")
        if (paid !== null && isRecentlyPaid(paid.paid_at, this.clock.now())) {
            return { ...base, reply: this.text("paymentConfirmedReply", { no: paid.invoice_no }), needsHuman: false }
        }
        // A payment with no open invoice of ours: a person has to look at it (the reply only says the shop will check).
        return { ...base, needsHuman: true, reason: "unclear_outcome" }
    }

    /** A chat application is validated and stored by Hiring; a refusal replaces the model's "thank you". */
    private async applyApplication(
        turn: CustomerTurn,
        reply: CustomerReply,
        text: string,
    ): Promise<AppliedApplication> {
        if (reply.application === null) return { reply: text, lines: [], changed: false }
        const stored = await this.hiring.registerChatApplication(
            turn.conversation.workspaceId,
            turn.conversation.id,
            reply.application,
        )
        if (stored.ok) return { reply: text, lines: [this.text("applicationStored", {})], changed: true }
        return {
            reply: this.text("applicationRefusedReply", { message: stored.message }),
            lines: [this.text("applicationNotStored", { message: stored.message })],
            changed: false,
        }
    }

    /**
     * Agent access through the conversation's connection: "auto" (or the website chat) sends; "ask" and "read" turn the reply into a
     * waiting answer with the draft, which the approved reply_customer sends. Answers the lines to show; none means the reply leaves now.
     */
    private async approvalOf(ctx: WorkContext, turn: CustomerTurn, reply: string): Promise<ReadonlyArray<string>> {
        const { conversation } = turn
        if (!(await this.needsApproval(conversation))) return []
        const { item, existed } = await this.openReplyItem(ctx, conversation, {
            dedupeKey: `reply_customer:access:${turn.messageId}`,
            question: turn.body,
            draft: reply,
            forceAsk: "over_authority",
            leadId: conversation.leadId,
        })
        if (!existed && item.status === "waiting_decision") await this.escalate(item, conversation, turn.body, reply)
        return [this.text("replyAwaitsApproval", {})]
    }

    /** True when this agent may not send through the conversation's connection on its own (access "ask" or "read"). */
    private async needsApproval(conversation: TurnConversation): Promise<boolean> {
        if (conversation.connectionId === null) return false
        const grants = await this.bindings.agentsFor(conversation.connectionId, PURPOSES)
        const mine = grants.find((grant) => grant.id === conversation.agent.id)
        return mine !== undefined && mine.access !== "auto"
    }

    /** The customer who shared a need and a name is handed to Sales through the gate, once per conversation. */
    private async handOff(
        ctx: WorkContext,
        turn: CustomerTurn,
        reply: CustomerReply,
        sent: string,
        channel: CustomerChannel,
    ): Promise<TurnSettled> {
        const { conversation } = turn
        const lead = reply.lead
        if (lead === null || conversation.leadId !== null) {
            return { lines: [], changed: false, leadId: conversation.leadId }
        }
        const contact = lead.phone ?? lead.email
        const recorded = await this.inbound.recordInput({
            workspaceId: ctx.workspaceId,
            channel: channel.key,
            kind: "lead",
            senderName: lead.contactName,
            senderContact: contact,
            body: lead.need,
            externalRef: conversation.id,
            eventId: turn.channelEventId,
        })
        // A redelivered channel event is one input: no second hand-off.
        if (recorded.duplicate) return { lines: [], changed: false, leadId: conversation.leadId }
        const item = await this.bus.sendCommandItem(ctx, {
            from: "inbound",
            to: "chatbot",
            command: "handoff_lead",
            reason: "the chatbot captured a lead",
            inboundEventId: recorded.inboundEventId,
            dedupeKey: `handoff_lead:conversation:${conversation.id}`,
            payload: {
                subject_type: "conversation",
                subject_id: conversation.id,
                contact_name: lead.contactName,
                company: lead.company,
                need: lead.need,
                contact,
                channel_label: channel.label,
                conversation_id: conversation.id,
                transcript: handoffTranscriptOf(turn.transcript, sent, lead.contactName, conversation.agent.name),
            },
        })
        // The conversation is now this customer: named after them (a channel account name is often not the person's name).
        await this.conversations.rename(conversation.id, lead.contactName)
        if (item.lead_id !== null) await this.conversations.attachLead(ctx.workspaceId, conversation.id, item.lead_id)
        const verdict =
            item.status === "done"
                ? this.text("verdictAuto", {})
                : this.text("verdictAsk", { reason: this.text(`reason.${item.reason ?? "routine"}`, {}) })
        return {
            lines: [this.text("chatHandoff", { verdict })],
            changed: true,
            leadId: item.lead_id ?? conversation.leadId,
        }
    }

    /** The answer needs a person: a waiting reply_customer item with the proposed answer, and the advising staff member tagged. */
    private async askPerson(
        ctx: WorkContext,
        turn: CustomerTurn,
        reply: CustomerReply,
        judged: Judged,
        leadId: string | null,
    ): Promise<ReadonlyArray<string>> {
        const { conversation } = turn
        const question = latestQuestionOf(turn.transcript, turn.body)
        const { item, existed } = await this.openReplyItem(ctx, conversation, {
            dedupeKey: `reply_customer:message:${turn.messageId}`,
            question,
            draft: reply.proposedAnswer ?? reply.reply,
            forceAsk: judged.reason ?? "unclear_outcome",
            leadId,
        })
        if (existed) return []
        if (item.status === "waiting_decision") {
            await this.escalate(
                item,
                { ...conversation, visitorName: reply.lead?.contactName ?? conversation.visitorName },
                question,
                reply.proposedAnswer,
            )
        }
        return [this.catalog.get("conversations.chatNeedsHuman", {}, LOCALE)]
    }

    /** A preset reply_customer item that always asks a person; `existed` when an earlier delivery of the turn already opened it. */
    private async openReplyItem(
        ctx: WorkContext,
        conversation: TurnConversation,
        spec: ReplyItemSpec,
    ): Promise<OpenedReplyItem> {
        const existed = (await this.items.findByDedupe(ctx.workspaceId, spec.dedupeKey)) !== null
        const item = await this.engine.runWork(ctx, {
            action: "reply_customer",
            subject_type: "conversation",
            subject_id: conversation.id,
            lead_id: spec.leadId,
            dedupeKey: spec.dedupeKey,
            preset: true,
            noChain: true,
            forceAsk: spec.forceAsk,
            seed: {
                summary: this.text("replySummary", { question: spec.question.slice(0, SUMMARY_QUESTION_MAX) }),
                draft: spec.draft,
                fields: { question: spec.question, conversation_id: conversation.id },
            },
        })
        return { item, existed }
    }

    private escalate(
        item: WorkItem,
        conversation: TurnConversation,
        question: string,
        proposed: string | null,
    ): Promise<boolean> {
        return this.staff.escalate(
            conversation.workspaceId,
            {
                workItemId: item.id,
                leadId: item.lead_id,
                customerName: conversation.visitorName ?? "",
                question,
                proposed,
            },
            LOCALE,
        )
    }

    /**
     * The chain steps a turn queued (the lead's classification, an order's invoice) run right after the turn, off the customer's
     * path; a step that cannot run now waits for the next drain.
     */
    private drainLater(ctx: WorkContext, steps: number): void {
        void this.engine.runQueued(ctx, steps).catch((cause: unknown) => {
            this.logger.error(CustomerTurnsLogEvent.DrainFailed, cause, { workspaceId: ctx.workspaceId })
        })
    }

    private channelOf(conversation: TurnConversation): CustomerChannel {
        const key = channelKeyOf(conversation.channel)
        return { key, label: this.text(`channel.${key}`, {}) }
    }

    private ctxOf(turn: CustomerTurn): WorkContext {
        return { workspaceId: turn.conversation.workspaceId, actor: ENGINE_ACTOR, locale: LOCALE }
    }

    private text(key: string, params: Readonly<Record<string, string>>): string {
        return this.catalog.get(`customerTurns.${key}`, params, LOCALE)
    }
}
