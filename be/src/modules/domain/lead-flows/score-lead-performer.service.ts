import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    Performed,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import { field, jsonOf } from "./lead-flow-fields.policy"
import type { FlowFields } from "./lead-flow-fields.policy"
import { contactIn } from "./lead-flow-identity.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { cleanSignals, handoffReady, mergeSignals, scoreLead } from "./lead-flow-score.policy"
import { effectiveConfidence, escalationOf, nextStep, parseAnalysis, recordAnswer } from "./lead-flow-steps.policy"
import { LeadFlowTurnService } from "./lead-flow-turn.service"
import { sourceKindOf } from "./lead-flow.mapper"
import type { Analysis, FlowSetup, LeadFlow, LeadFlowPatch, Signals, SourceKind } from "./lead-flows.contracts"

/** What score_lead decides: a step of the state machine, or `comment` (answer in public and in private). */
type Plan = "comment" | "escalate" | "greet" | "ask" | "ask_contact" | "handoff" | "follow_up" | "close" | "hold"

/** The reading of one turn and what it costs. */
interface TurnRead {
    /** The analysis, or null. */
    readonly analysis: Analysis | null
    /** The model could not read the turn. */
    readonly aiFailed: boolean
}

/** What the turn is about. */
interface TurnContext {
    /** The flow. */
    readonly flow: LeadFlow
    /** The kind of touch. */
    readonly kind: SourceKind
    /** The turn key. */
    readonly turn: string
    /** What the person wrote. */
    readonly text: string
    /** The owner's setup. */
    readonly setup: FlowSetup
}

@Injectable()
/**
 * `score_lead`: reads the turn (at most one model call, none for a retried turn or a keyword escalation), scores hot / warm / cold from the
 * signals (pure), decides the next step, or hands the prospect to a person. Performing stores the signals, the score and the answer.
 */
export class ScoreLeadPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
        private readonly turns: LeadFlowTurnService,
        private readonly leads: LeadRecordsService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("score_lead", this)
    }

    /** Reads and scores the turn and decides the next step. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        let flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const fields = item.proposal.fields
        if (flow.state === "escalated") {
            // A person holds this lead: the bot reads nothing and says nothing until they hand it back.
            if (await this.kit.transcript.heldByPerson(flow))
                return this.proposal(item, this.kit.text(ctx.locale, "score.held"), { ...fields, step: "hold" })
            flow = await this.kit.resume(flow)
        }
        const kind = sourceKindOf(field(fields, "source_kind"), flow.source?.kind ?? "dm")
        const turn = field(fields, "turn") || `manual:${item.id}`
        const text = (field(fields, "text") || (kind === "dm" ? (flow.last_user_text ?? "") : "")).trim()
        const setup = await this.turns.setup(ctx.workspaceId)
        const context: TurnContext = { flow, kind, turn, text, setup }
        const read = await this.read(ctx, context, fields)
        const confidence = read.analysis === null ? 0 : effectiveConfidence(read.analysis)
        const base = {
            turn,
            conversation_id: flow.conversation_id ?? "",
            connection_id: flow.connection_id ?? "",
            source_kind: kind,
            comment_id: field(fields, "comment_id"),
            post_id: field(fields, "post_id"),
        }
        const reason = escalationOf({ text, flags: read.analysis?.flags ?? null, confidence, aiFailed: read.aiFailed })
        if (reason !== null || read.analysis === null) {
            const why = reason ?? "unreadable"
            await this.kit.escalate(ctx, { flow, reason: why, text, turn, item, notify: kind === "dm" })
            const summary = this.kit.text(ctx.locale, "score.escalate", {
                name: this.kit.nameOf(ctx, flow),
                reason: this.kit.reasonText(ctx.locale, why),
            })
            return this.proposal(item, summary, { ...fields, ...base, step: "escalate", escalation: why, confidence })
        }
        return this.decide(ctx, item, context, read.analysis, { ...fields, ...base, confidence })
    }

    /** Stores the signals, the score and the answer to the pending question. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const fields = proposal.fields
        const step = field(fields, "step")
        if (step === "escalate") return this.kit.done(proposal.summary, flow)
        const signals = this.storedSignals(flow, field(fields, "signals"))
        const contact = contactIn(signals.contact ?? "")
        const patch: LeadFlowPatch = {
            signals,
            score: field(fields, "score") === "" ? flow.score : this.levelOf(field(fields, "score")),
            score_reasons: field(fields, "score_reasons") === "" ? [] : field(fields, "score_reasons").split("; "),
            scored_at: this.kit.now(),
            ...(await this.answerPatch(ctx, flow, fields)),
            ...(contact.phone !== null && flow.phone === null ? { phone: contact.phone } : {}),
            ...(contact.email !== null && flow.email === null ? { email: contact.email } : {}),
            ...(step === "hold" && flow.state === "new" ? { state: "scored" as const } : {}),
        }
        const next = await this.kit.store.patch(flow, patch)
        if (flow.lead_id !== null && (contact.phone !== null || contact.email !== null))
            await this.leads.fillContact({
                workspaceId: ctx.workspaceId,
                leadId: flow.lead_id,
                phone: contact.phone,
                email: contact.email,
            })
        const evidence = [
            field(fields, "score_reasons"),
            next.answers.length > 0 ? this.kit.text(ctx.locale, "score.answers", { count: next.answers.length }) : "",
        ]
            .filter((line) => line !== "")
            .join(" · ")
        await this.kit.log(ctx, flow, item.id, "lead_gen.scored", proposal.summary, evidence)
        return this.kit.done(proposal.summary, flow)
    }

    /** One metered model call per turn; none when the turn already has its reading (a retried step) or carries no text to read. */
    private async read(ctx: WorkContext, context: TurnContext, fields: FlowFields): Promise<TurnRead> {
        const { flow, kind, turn, text, setup } = context
        if (flow.analysis?.turn === turn) return { analysis: flow.analysis, aiFailed: false }
        let analysis: Analysis | null = null
        let aiFailed = false
        if ((kind === "comment" || kind === "mention") && text === "") {
            analysis = parseAnalysis({ confidence: 1 }, turn)
        } else if (kind === "leadgen" && text === "") {
            const need = field(fields, "need").split("\n")[0] ?? ""
            analysis = parseAnalysis(
                {
                    signals: { need: need === "" ? null : need, contact: field(fields, "contact"), interest: "medium" },
                    confidence: 1,
                },
                turn,
            )
        } else if (kind === "dm" && text === "") {
            aiFailed = true
        } else {
            const agent = await this.kit.transcript.leadGenAgent(ctx.workspaceId, flow.connection_id)
            const pending = flow.pending_question === null ? null : (setup.questions[flow.pending_question] ?? null)
            const reading = await this.turns.read(ctx, {
                agent,
                turn,
                kind,
                text,
                name: flow.name,
                pendingQuestion: pending,
                criteriaText: setup.criteriaText,
                first: flow.state === "new" && kind === "dm",
            })
            analysis = reading.analysis
            aiFailed = analysis === null
        }
        if (analysis !== null) await this.kit.store.patch(flow, { analysis })
        const gap = analysis?.knowledge_gap ?? null
        if (gap !== null && flow.conversation_id !== null)
            await this.turns.noteGap(ctx.workspaceId, { ...gap, conversationId: flow.conversation_id })
        return { analysis, aiFailed }
    }

    /** Signals, score and the state machine's step. */
    private async decide(
        ctx: WorkContext,
        item: WorkItem,
        context: TurnContext,
        analysis: Analysis,
        fields: FlowFields,
    ): Promise<Prepared> {
        const { flow, kind, setup } = context
        const given = contactIn(field(fields, "contact"))
        const merged = mergeSignals(flow.signals, analysis.signals)
        const firstNeed = field(fields, "need").split("\n")[0] ?? ""
        const signals: Signals = {
            ...merged,
            contact: merged.contact ?? given.phone ?? given.email ?? flow.phone ?? flow.email,
            need: merged.need ?? (kind === "leadgen" && firstNeed !== "" ? firstNeed : null),
        }
        const score = scoreLead(signals, setup.criteria)
        const ready = handoffReady(signals, flow)
        const window = await this.kit.meta.windowOf(flow)
        const decided = nextStep({
            state: flow.state,
            kind,
            questions: setup.questions,
            asked: flow.asked,
            score,
            handoffOk: score.level === "hot" && ready.ok,
            canMessage: kind === "dm" && window.status === "open",
            contactKnown: signals.contact !== null,
            contactAsked: flow.contact_asked_at !== null,
            greeted: flow.greeted_at !== null,
        })
        let step: Plan = decided.step
        if (kind === "comment") step = "comment"
        else if (kind === "mention") step = "hold"
        const index = decided.step === "ask" ? decided.index : flow.asked
        const question = decided.step === "ask" ? (setup.questions[decided.index] ?? "") : ""
        const handoffAlso = score.level === "hot" && ready.ok && step !== "handoff" && step !== "hold"
        const summary = this.kit.text(ctx.locale, "score.summary", {
            name: this.kit.nameOf(ctx, flow),
            level: score.level,
            step: this.kit.text(ctx.locale, `step.${step}`),
        })
        return this.proposal(item, summary, {
            ...fields,
            step,
            index,
            question,
            score: score.level,
            score_reasons: score.reasons.join("; "),
            sentiment: analysis.sentiment,
            reply: analysis.reply,
            public_reply: analysis.public_reply,
            private_reply: analysis.private_reply,
            contact: ready.contact ?? "",
            need: ready.need ?? "",
            handoff: handoffAlso ? "1" : "",
            negative: kind === "comment" && analysis.sentiment === "negative" ? "1" : "",
            signals: JSON.stringify(signals),
            answer: analysis.answer ?? "",
        })
    }

    private proposal(item: WorkItem, summary: string, fields: FlowFields): Prepared {
        return { proposal: { ...item.proposal, summary, fields } }
    }

    private storedSignals(flow: LeadFlow, raw: string): Signals {
        const parsed = raw === "" ? undefined : jsonOf(raw).value
        return parsed === undefined ? flow.signals : mergeSignals(flow.signals, cleanSignals(parsed))
    }

    private levelOf(value: string): LeadFlow["score"] {
        return value === "hot" || value === "warm" || value === "cold" ? value : null
    }

    /** The reply to the question that was pending is its answer (one answer per question, kept on the flow). */
    private async answerPatch(ctx: WorkContext, flow: LeadFlow, fields: FlowFields): Promise<LeadFlowPatch> {
        if (field(fields, "source_kind") !== "dm" || flow.pending_question === null) return {}
        const setup = await this.turns.setup(ctx.workspaceId)
        const answer = field(fields, "answer") || (flow.last_user_text ?? "")
        if (answer === "") return { pending_question: null }
        return {
            pending_question: null,
            answers: recordAnswer(flow.answers, {
                i: flow.pending_question,
                question: setup.questions[flow.pending_question] ?? "",
                answer,
                at: this.kit.now(),
            }),
        }
    }
}
