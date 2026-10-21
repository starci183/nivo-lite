import { Injectable } from "@nestjs/common"
import { CommandBusService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LEAD_GEN_ACTOR, LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { sourceLine, textOf } from "./lead-flow-identity.policy"
import type { DmOutcome, EscalationReason, LeadFlow, LeadSource } from "./lead-flows.contracts"

/** What handing a prospect to a person takes. */
export interface HoldRequest {
    /** The flow. */
    readonly flow: LeadFlow
    /** Why. */
    readonly reason: EscalationReason
    /** The work item a person decides. */
    readonly itemId: string
    /** What the person wrote. */
    readonly question: string
    /** A direct message: tell the person once that a colleague takes over. */
    readonly notify: boolean
}

/** What escalating a turn takes. */
export interface EscalationRequest {
    /** The flow. */
    readonly flow: LeadFlow
    /** Why. */
    readonly reason: EscalationReason
    /** What the person wrote. */
    readonly text: string
    /** The turn. */
    readonly turn: string
    /** The work item that found it. */
    readonly item: WorkItem
    /** A direct message: tell the person once. */
    readonly notify: boolean
}

/** What a direct message step answers. */
export interface DmSend {
    /** It went. */
    readonly sent: boolean
    /** The line for the work item when it did not. */
    readonly line: string
}

/** Text parameters. */
export type TextParams = Readonly<Record<string, string | number>>

/** The text of a proposal field, or "". */
export const fieldText = (proposal: Proposal, key: string): string => textOf(proposal.fields[key])

/** The ISO instant of a moment. */
const isoOf = (date: Date): string => date.toISOString()

@Injectable()
/** What every lead_gen performer reaches for: its texts, the flow, the transcript, the direct message with its window, and the hand-over. */
export class LeadFlowKitService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
        readonly store: LeadFlowStoreService,
        readonly meta: LeadFlowMetaService,
        readonly transcript: LeadFlowConversationService,
        private readonly engine: WorkEngineService,
        private readonly commands: CommandBusService,
        private readonly evidence: EvidenceService,
    ) {}

    /** A lead-flow text in the language. */
    text(locale: Locale, key: string, params: TextParams = {}): string {
        return this.catalog.get(`lead-flows.${key}`, params, locale)
    }

    /** Now, as an ISO instant. */
    now(): string {
        return isoOf(this.clock.now())
    }

    /** The prospect's name, or the plain word for them. */
    nameOf(ctx: WorkContext, flow: Pick<LeadFlow, "name"> | null, fallbackKey = "customer"): string {
        return flow?.name ?? this.text(ctx.locale, fallbackKey)
    }

    /** One line naming where a touch came from, in the language. */
    sourceLine(locale: Locale, source: LeadSource | null): string {
        return sourceLine(source, {
            kind: this.text(locale, `kind.${source?.kind ?? "dm"}`),
            form: this.text(locale, "word.form"),
            ad: this.text(locale, "word.ad"),
            post: this.text(locale, "word.post"),
        })
    }

    /** The label of an escalation reason. */
    reasonText(locale: Locale, reason: EscalationReason): string {
        return this.text(locale, `reason.${reason}`)
    }

    /** What a step did, for the log. */
    done(summary: string, flow: Pick<LeadFlow, "lead_id"> | null, detail: string | null = null): Performed {
        const leadId = flow?.lead_id ?? null
        return {
            summary,
            evidence: "captured",
            href: leadId === null ? "/chat" : `/leads/${leadId}`,
            lead_id: leadId,
            detail,
        }
    }

    /** Writes one evidence line of the lead generation flow. */
    async log(
        ctx: WorkContext,
        flow: Pick<LeadFlow, "lead_id">,
        itemId: string,
        kind: string,
        summary: string,
        evidence: string | null,
    ): Promise<void> {
        await this.evidence.log(ctx, {
            lead_id: flow.lead_id,
            work_item_id: itemId,
            kind,
            actor: LEAD_GEN_ACTOR,
            summary,
            evidence: evidence === null || evidence === "" ? null : evidence.slice(0, 400),
        })
    }

    /** One direct message to the flow's person, stored in the transcript with its delivery. */
    async dm(ctx: WorkContext, flow: LeadFlow, text: string, humanAgent = false): Promise<DmOutcome> {
        const outcome = await this.meta.sendToFlow(ctx.workspaceId, flow, text, humanAgent)
        if (outcome.ok || outcome.reason === "failed") {
            await this.transcript.say({
                workspaceId: ctx.workspaceId,
                conversationId: flow.conversation_id,
                role: "agent",
                body: text,
                delivery: { sent: outcome.ok, error: outcome.ok ? null : `meta_${outcome.detail ?? "error"}` },
            })
        }
        return outcome
    }

    /** The proposal of a closing or follow-up step: the reply of the turn, then a fixed line. */
    async lineProposal(ctx: WorkContext, item: WorkItem, lineKey: string, summaryKey: string): Promise<Prepared> {
        const flow = await this.store.requireByLead(ctx.workspaceId, item.lead_id)
        const draft = [fieldText(item.proposal, "reply"), this.text(ctx.locale, lineKey)]
            .filter((line) => line !== "")
            .join("\n\n")
        const summary = this.text(ctx.locale, summaryKey, { name: this.nameOf(ctx, flow) })
        return { proposal: { ...item.proposal, summary, draft } }
    }

    /** Why a direct message did not go, as one line for the work item. */
    notSent(locale: Locale, outcome: DmOutcome): string {
        if (outcome.reason === "no_recipient") return this.text(locale, "not-sent.no-recipient")
        if (outcome.reason === "not_connected") return this.text(locale, "not-sent.no-page")
        return this.text(locale, "not-sent.window")
    }

    /**
     * Sends inside the window, or explains. Between 24 hours and 7 days only a person may reply with the HUMAN_AGENT tag, so with
     * `offerTag` that reply is proposed as an ask-mode action carrying the text. A real Meta failure is an error of the step.
     */
    async dmOrExplain(
        ctx: WorkContext,
        item: WorkItem,
        flow: LeadFlow,
        text: string,
        offerTag: boolean,
    ): Promise<DmSend> {
        const outcome = await this.dm(ctx, flow, text)
        if (outcome.ok) return { sent: true, line: "" }
        if (outcome.reason === "failed") throw this.metaRefused(outcome.detail)
        if (outcome.reason !== "tag_only" || !offerTag) return { sent: false, line: this.notSent(ctx.locale, outcome) }
        await this.commands.sendCommand(ctx, {
            from: "lead_gen",
            to: "lead_gen",
            command: "message_with_human_agent_tag",
            reason: "outside_24h",
            parentId: item.id,
            chainId: item.chain_id ?? item.id,
            inboundEventId: item.inbound_event_id,
            queue: true,
            dedupeKey: `message_with_human_agent_tag:${item.id}`,
            payload: {
                subject_type: "lead",
                subject_id: flow.lead_id,
                lead_id: flow.lead_id,
                contact: flow.phone ?? flow.email ?? flow.psid ?? flow.igsid ?? "",
                conversation_id: flow.conversation_id ?? "",
            },
            seed: { summary: this.text(ctx.locale, "tag.summary", { name: this.nameOf(ctx, flow) }), draft: text },
        })
        return { sent: false, line: this.text(ctx.locale, "tag.proposed") }
    }

    /** The error a Meta refusal becomes. */
    metaRefused(failure: string | null): LeadFlowsError {
        return new LeadFlowsError({ code: LeadFlowsErrorCode.MetaRefused, params: { failure: failure ?? "error" } })
    }

    /**
     * A person takes this prospect: the flow becomes `escalated` (resume_state keeps where it was), the conversation is held by a person
     * so the bot is silent until they hand it back, and a direct message gets one honest line that a colleague takes over.
     */
    async holdForPerson(ctx: WorkContext, request: HoldRequest): Promise<LeadFlow> {
        const { flow, reason } = request
        const already = flow.state === "escalated"
        const next = await this.store.patch(flow, {
            state: "escalated",
            resume_state: already ? flow.resume_state : flow.state,
            escalated_at: already ? flow.escalated_at : this.now(),
            escalation_reason: reason,
        })
        const reasonText = this.reasonText(ctx.locale, reason)
        if (flow.conversation_id !== null) {
            await this.transcript.handToPerson(ctx.workspaceId, flow.conversation_id)
            await this.transcript.say({
                workspaceId: ctx.workspaceId,
                conversationId: flow.conversation_id,
                role: "system",
                body: this.text(ctx.locale, "escalate.line", { reason: reasonText }),
                delivery: null,
            })
        }
        await this.log(
            ctx,
            flow,
            request.itemId,
            "lead_gen.escalated",
            this.text(ctx.locale, "escalate.evidence", { reason: reasonText }),
            request.question,
        )
        if (!already && request.notify) await this.dm(ctx, next, this.text(ctx.locale, "line.handover"))
        return next
    }

    /**
     * Hands the prospect to a person through the needs-a-person path (a reply_customer item that always asks) and stops the bot.
     * Idempotent per flow and turn.
     */
    async escalate(ctx: WorkContext, request: EscalationRequest): Promise<LeadFlow> {
        const { flow, reason, item } = request
        const question = request.text.trim() || this.text(ctx.locale, "no-text")
        const asked = await this.engine.runWork(ctx, {
            action: "reply_customer",
            subject_type: flow.conversation_id === null ? "lead" : "conversation",
            subject_id: flow.conversation_id ?? flow.lead_id,
            lead_id: flow.lead_id,
            parent_id: item.id,
            chainId: item.chain_id ?? item.id,
            dedupeKey: `reply_customer:lead_gen:${flow.id}:${request.turn}`,
            preset: true,
            noChain: true,
            forceAsk: "unclear_outcome",
            seed: {
                summary: this.text(ctx.locale, "escalate.item", {
                    name: this.nameOf(ctx, flow),
                    reason: this.reasonText(ctx.locale, reason),
                    question: question.slice(0, 120),
                }),
                draft: "",
                fields: {
                    question,
                    escalation: reason,
                    ...(flow.conversation_id === null ? {} : { conversation_id: flow.conversation_id }),
                },
            },
        })
        return this.holdForPerson(ctx, { flow, reason, itemId: asked.id, question, notify: request.notify })
    }

    /** A person handed the conversation back: the bot resumes where the flow was before the escalation. */
    resume(flow: LeadFlow): Promise<LeadFlow> {
        return this.store.patch(flow, {
            state: flow.resume_state ?? "qualifying",
            resume_state: null,
            escalated_at: null,
            escalation_reason: null,
        })
    }
}
