import { Injectable } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { EvidenceService } from "@modules/domain/decisions"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
import { ExecutionsService } from "@modules/domain/executions"
import { LeadRecordsService } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { InjectPromptWriter } from "./work-performers.decorators"
import type { PromptWriter } from "./work-performers.port"
import { PerformerKitService } from "./performer-kit.service"
import { leadHref, renewalNoticeOf, textOf } from "./performer.policy"

@Injectable()
/**
 * `send_follow_up`: the sales AI drafts the next message of a customer's responsibility; once allowed it is delivered, the approval card
 * is settled and the responsibility is done. A rejection reopens the responsibility.
 */
export class FollowUpPerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly leads: LeadRecordsService,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly agents: AgentsService,
        @InjectPromptWriter() private readonly deepseek: PromptWriter,
        private readonly delivery: CustomerDeliveryService,
        private readonly executions: ExecutionsService,
        private readonly workItems: WorkItemsService,
        private readonly evidence: EvidenceService,
    ) {}

    /** One model call: the draft of the next message, written as the agent that owns the responsibility. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const lead = await this.leads.require(ctx.workspaceId, this.leadIdOf(item))
        const base = item.proposal.fields
        const contact = await this.delivery.contactOf(ctx.workspaceId, lead)
        const named = textOf(base.responsibility_id)
        const found = named === "" ? null : await this.responsibilities.find(ctx.workspaceId, named)
        const responsibility = found ?? (await this.responsibilities.ensureFor(ctx, lead.id))
        const agent =
            responsibility.owner_agent_id === null
                ? await this.agents.profileOfDepartment(ctx.workspaceId, "sales")
                : await this.agents.profileOf(ctx.workspaceId, responsibility.owner_agent_id)
        const draft = await this.deepseek.draftFollowUp(
            this.kit.scope(ctx),
            this.kit.leadInput(lead),
            lead.context_summary ?? "",
            responsibility.next_action,
            agent,
            await this.kit.brief(ctx),
        )
        return {
            proposal: {
                summary: this.kit.text(ctx, "followSummary", { name: lead.contact_name }),
                draft,
                fields: { ...base, customer: lead.contact_name, contact, responsibility_id: responsibility.id },
            },
        }
    }

    /** Delivers the message, settles the approval card (opening one when the gate ran alone) and closes the responsibility. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const lead = await this.leads.require(ctx.workspaceId, this.leadIdOf(item))
        const text = proposal.draft ?? proposal.summary
        // A renewal also carries its notice, so Zalo can send it as a ZNS template when the 48-hour chat window is closed.
        const notice = renewalNoticeOf(proposal.fields)
        const sent =
            notice === undefined
                ? await this.delivery.toCustomer(ctx, lead, text)
                : await this.delivery.toCustomer(ctx, lead, text, notice)
        const responsibilityId =
            textOf(proposal.fields.responsibility_id) === ""
                ? (await this.responsibilities.ensureFor(ctx, lead.id)).id
                : textOf(proposal.fields.responsibility_id)
        await this.approveCard(ctx, item, responsibilityId, text, by)
        await this.responsibilities.setStatus(ctx, responsibilityId, "done")
        await this.evidence.log(ctx, {
            lead_id: lead.id,
            work_item_id: item.id,
            kind: "execution.approved",
            actor: by.name,
            summary: sent.summary,
            evidence: text,
        })
        return { summary: sent.summary, evidence: "captured", href: leadHref(lead.id), lead_id: lead.id, detail: text }
    }

    /** A rejection settles the approval card as rejected and gives the responsibility back. */
    async onReject(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<void> {
        if (item.execution_id !== null) {
            await this.executions.settle({
                workspaceId: ctx.workspaceId,
                executionId: item.execution_id,
                decision: "rejected",
                decidedBy: ctx.actor,
                editedDraft: null,
            })
        }
        const responsibilityId = textOf(proposal.fields.responsibility_id)
        if (responsibilityId !== "") await this.responsibilities.setStatus(ctx, responsibilityId, "open")
    }

    private async approveCard(
        ctx: WorkContext,
        item: WorkItem,
        responsibilityId: string,
        text: string,
        by: PerformedBy,
    ): Promise<void> {
        const cardId = item.execution_id ?? (await this.openCard(ctx, item, responsibilityId, text))
        await this.executions.settle({
            workspaceId: ctx.workspaceId,
            executionId: cardId,
            decision: "approved",
            decidedBy: by.name,
            editedDraft: text,
        })
    }

    private async openCard(ctx: WorkContext, item: WorkItem, responsibilityId: string, text: string): Promise<string> {
        const sales = await this.agents.agentOfDepartment(ctx.workspaceId, "sales", null)
        const cardId = await this.executions.open({
            workspaceId: ctx.workspaceId,
            responsibilityId,
            agentId: sales?.id ?? null,
            draft: text,
            workItemId: item.id,
        })
        await this.workItems.attachExecution(ctx.workspaceId, item.id, cardId)
        return cardId
    }

    private leadIdOf(item: WorkItem): string {
        if (item.lead_id === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        return item.lead_id
    }
}
