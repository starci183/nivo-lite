import { Injectable } from "@nestjs/common"
import { EvidenceService } from "@modules/domain/decisions"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { LeadRecordsService } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { InjectPromptWriter } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"
import { PerformerKitService } from "./performer-kit.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { historyLine, leadHref, stageOf, textOf } from "./performer.policy"

/** How many lines of the customer's history a classification reads. */
const HISTORY_LINES = 12
/** Below this confidence the stage is not clear and the owner is asked. */
const CLEAR_CONFIDENCE = 0.6

@Injectable()
/** `classify_lead`: the sales AI reads the customer's history, sets the stage of an open deal and keeps a context brief. */
export class ClassifyLeadPerformer implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly leads: LeadRecordsService,
        private readonly events: EventsService,
        @InjectPromptWriter() private readonly deepseek: PromptWriter,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly evidence: EvidenceService,
    ) {}

    /** One model call: the stage, the next step, what is missing and a context brief. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const lead = await this.leads.require(ctx.workspaceId, this.leadIdOf(item))
        const history = (await this.events.leadHistory(ctx.workspaceId, lead.id, HISTORY_LINES)).map((line) =>
            historyLine(line.summary, line.evidence),
        )
        const result = await this.deepseek.classifyLead(
            this.kit.scope(ctx),
            this.kit.leadInput(lead),
            history,
            await this.kit.brief(ctx),
        )
        const summary = this.kit.text(ctx, "classifySummary", {
            name: lead.contact_name,
            stage: this.kit.stage(ctx, result.stage),
            pct: Math.round(result.confidence * 100),
        })
        return {
            proposal: {
                summary,
                confidence: result.confidence,
                outcome: result.confidence < CLEAR_CONFIDENCE ? "unclear" : "clear",
                fields: {
                    stage: result.stage,
                    next_action: result.next_action,
                    context: result.context,
                    missing: result.missing.join(", ") === "" ? null : result.missing.join(", "),
                },
            },
        }
    }

    /** Moves an open deal forward, keeps the first context brief and sets the next step of the customer's responsibility. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const lead = await this.leads.require(ctx.workspaceId, this.leadIdOf(item))
        const fields = proposal.fields
        const context = textOf(fields.context)
        await this.leads.classify({
            workspaceId: ctx.workspaceId,
            leadId: lead.id,
            stage: stageOf(textOf(fields.stage)),
            contextSummary: context === "" ? null : context,
        })
        const next = textOf(fields.next_action)
        if (next !== "") {
            const responsibility = await this.responsibilities.ensureFor(ctx, lead.id)
            await this.responsibilities.setNextAction(ctx, responsibility.id, next)
        }
        if (lead.context_summary === null && context !== "") {
            await this.evidence.log(ctx, {
                lead_id: lead.id,
                work_item_id: item.id,
                kind: "context.summarised",
                actor: await this.kit.department(ctx, "sales"),
                summary: this.kit.text(ctx, "contextCreated"),
                evidence: context,
            })
        }
        const proposed = stageOf(textOf(fields.stage))
        const open = lead.stage !== "won" && lead.stage !== "lost"
        const moved = open && proposed !== null && proposed !== "won" ? proposed : lead.stage
        return {
            summary: this.kit.text(ctx, "classified", {
                name: lead.contact_name,
                stage: this.kit.stage(ctx, moved),
                next: next === "" ? "—" : next,
            }),
            evidence: "captured",
            href: leadHref(lead.id),
            lead_id: lead.id,
        }
    }

    private leadIdOf(item: WorkItem): string {
        if (item.lead_id === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        return item.lead_id
    }
}
