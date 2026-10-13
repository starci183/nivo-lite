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
import { field } from "./lead-flow-fields.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { handoffReady } from "./lead-flow-score.policy"
import { handoffNeed } from "./lead-flow-steps.policy"

@Injectable()
/**
 * `handoff_to_sales`: a hot lead goes to Sales with its package (need, answers, score and why, source, last message); the engine's
 * chain then asks Sales to classify it. A warm or cold lead is "unclear" to the gate, so a person decides.
 */
export class HandoffToSalesPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
        private readonly leads: LeadRecordsService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("handoff_to_sales", this)
    }

    /** The contact and the need the gate requires; only a hot lead goes on its own. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const flow = await this.kit.store.byLead(ctx.workspaceId, item.lead_id)
        const fields = item.proposal.fields
        const ready = flow === null ? null : handoffReady(flow.signals, flow)
        const level = flow?.score ?? field(fields, "score")
        const lead = item.lead_id === null ? null : await this.leads.find(ctx.workspaceId, item.lead_id)
        const name = lead?.contact_name ?? flow?.name ?? ""
        const hot = level === "hot"
        const summary = hot
            ? this.kit.text(ctx.locale, "handoff.hot", { name })
            : this.kit.text(ctx.locale, "handoff.ask", {
                  name,
                  level: this.kit.text(ctx.locale, `level.${level || "cold"}`),
              })
        return {
            proposal: {
                ...item.proposal,
                summary,
                ...(hot ? {} : { outcome: "unclear" as const }),
                fields: {
                    ...fields,
                    contact: field(fields, "contact") || (ready?.contact ?? ""),
                    need: field(fields, "need") || (ready?.need ?? lead?.need ?? ""),
                    score: level,
                },
            },
        }
    }

    /** Writes the package as the lead's need (and brief when it has none), closes the bot's part, and logs the hand-off. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const flow = await this.kit.store.requireByLead(ctx.workspaceId, item.lead_id)
        const need = field(proposal.fields, "need")
        const pack = handoffNeed({
            need: need === "" ? null : need,
            score: { level: flow.score ?? "hot", reasons: flow.score_reasons, missing: [] },
            answers: flow.answers,
            sourceLine: this.kit.sourceLine(ctx.locale, flow.source),
            lastUserAt: flow.last_user_at,
            labels: {
                answers: this.kit.text(ctx.locale, "label.answers"),
                score: this.kit.text(ctx.locale, "label.score"),
                source: this.kit.text(ctx.locale, "label.source"),
                lastMessage: this.kit.text(ctx.locale, "label.last-message"),
            },
        })
        if (flow.lead_id !== null) await this.leads.handOver(ctx.workspaceId, flow.lead_id, pack)
        await this.kit.store.patch(flow, { state: "handed_off", handed_off_at: this.kit.now(), pending_question: null })
        const level = flow.score ?? "hot"
        await this.kit.log(
            ctx,
            flow,
            item.id,
            "lead_gen.handoff",
            this.kit.text(ctx.locale, "handoff.evidence", { level }),
            pack,
        )
        return this.kit.done(this.kit.text(ctx.locale, "handoff.done", { name: this.kit.nameOf(ctx, flow) }), flow)
    }
}
