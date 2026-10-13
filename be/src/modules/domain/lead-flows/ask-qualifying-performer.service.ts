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
import { field } from "./lead-flow-fields.policy"
import { clip } from "./lead-flow-identity.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { MAX_QUESTIONS } from "./lead-flow-score.policy"
import { composeAsk } from "./lead-flow-steps.policy"
import { LeadFlowTurnService } from "./lead-flow-turn.service"

@Injectable()
/** `ask_qualifying`: the owner's next question (at most four, one per turn), or the contact once; the answer is read next turn. */
export class AskQualifyingPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
        private readonly turns: LeadFlowTurnService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("ask_qualifying", this)
    }

    /** The short reply of the turn, then the question verbatim. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const fields = item.proposal.fields
        const setup = await this.turns.setup(ctx.workspaceId)
        const contactAsk = field(fields, "question_kind") === "contact"
        const index =
            Number.isFinite(Number(fields.index)) && field(fields, "index") !== "" ? Number(fields.index) : flow.asked
        const question = contactAsk
            ? this.kit.text(ctx.locale, "line.ask-contact")
            : field(fields, "question") || (setup.questions[index] ?? "")
        const draft =
            question === ""
                ? ""
                : composeAsk({
                      reply: field(fields, "reply"),
                      question,
                      thanks: this.kit.text(ctx.locale, "line.thanks"),
                  })
        const summary = this.kit.text(ctx.locale, "ask.summary", {
            name: this.kit.nameOf(ctx, flow),
            n: flow.asked + 1,
        })
        return {
            proposal: {
                ...item.proposal,
                summary,
                draft,
                fields: { ...fields, index, question_kind: contactAsk ? "contact" : "" },
            },
        }
    }

    /** Asks inside the window; a repeated or late command asks nothing more. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const fields = proposal.fields
        const draft = proposal.draft ?? ""
        const contactAsk = field(fields, "question_kind") === "contact"
        if (draft === "") return this.kit.done(this.kit.text(ctx.locale, "ask.no-question"), flow)
        if (flow.asked >= MAX_QUESTIONS) return this.kit.done(this.kit.text(ctx.locale, "ask.maxed"), flow)
        if (flow.pending_question !== null && !contactAsk)
            return this.kit.done(this.kit.text(ctx.locale, "ask.waiting"), flow)
        const sent = await this.kit.dmOrExplain(ctx, item, flow, draft, true)
        if (!sent.sent) return this.kit.done(sent.line, flow)
        const now = this.kit.now()
        await this.kit.store.patch(flow, {
            state: "qualifying",
            asked: flow.asked + 1,
            pending_question: contactAsk ? null : Number(fields.index) || 0,
            ...(contactAsk ? { contact_asked_at: now } : {}),
            ...(flow.greeted_at === null ? { greeted_at: now } : {}),
        })
        const summary = this.kit.text(ctx.locale, "ask.done", { n: flow.asked + 1 })
        const asked = field(fields, "question")
        return this.kit.done(asked === "" ? summary : `${summary} (${clip(asked, 60)})`, flow, draft)
    }
}
