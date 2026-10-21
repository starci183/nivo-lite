import { Injectable } from "@nestjs/common"
import { ExecutionsService } from "@modules/domain/executions"
import { InjectAgentDirectory, OfficeLinesService } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { GateVerdict, OptionalAuthorityRule, Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import { EvidenceService } from "./evidence.service"
import { isOverLimit } from "@modules/domain/authority-rules"
import { ModuleCatalogService } from "./module-catalog.service"
import type { Judgement } from "./work-engine.contracts"
import { InjectInboundEventStatus } from "./work-engine.decorators"
import { formatVnd } from "./work-engine.policy"
import type { InboundEventStatus } from "./work-engine.port"

/** Separates the parts of a one-line evidence text. */
const SEPARATOR = " · "

@Injectable()
/** Puts an item in front of a person: the waiting state, the approval card of a follow-up, and the evidence, Office and inbound lines. */
export class WorkApprovalService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectAgentDirectory() private readonly agents: AgentDirectory,
        @InjectInboundEventStatus() private readonly inbound: InboundEventStatus,
        private readonly items: WorkItemsService,
        private readonly executions: ExecutionsService,
        private readonly modules: ModuleCatalogService,
        private readonly evidence: EvidenceService,
        private readonly office: OfficeLinesService,
        private readonly responsibilities: ResponsibilityJournalService,
    ) {}

    /** The names of the fields in the language of the reader; a field without a label shows as it is. */
    fieldLabels(ctx: WorkContext, fields: ReadonlyArray<string>): string {
        return fields
            .map((field) => {
                const key = `engine.field.${field}`
                const label = this.catalog.get(key, {}, ctx.locale)
                return label === key ? field : label
            })
            .join(", ")
    }

    /** The item waits for a decision; the person is told in the evidence log, the Office and the inbound status. */
    async ask(ctx: WorkContext, item: WorkItem, proposal: Proposal, judgement: Judgement): Promise<WorkItem> {
        const { verdict, rule } = judgement
        const waiting = await this.items.markWaiting(item.id, {
            reason: verdict.reason,
            reasons: verdict.reasons,
            missing: verdict.missing,
            proposal,
            executionId: await this.approvalCardFor(ctx, item, proposal, verdict),
        })
        const reason = this.catalog.get(`engine.reason.${verdict.reason}`, {}, ctx.locale)
        const notes = [
            verdict.missing.length > 0 ? this.fieldLabels(ctx, verdict.missing) : "",
            verdict.reasons.includes("over_authority") ? this.limitNote(ctx, rule, proposal) : "",
        ].filter((note) => note !== "")
        const dept = await this.modules.nameOf(waiting.department, ctx.locale)
        await this.evidence.log(ctx, {
            lead_id: waiting.lead_id,
            work_item_id: waiting.id,
            kind: "work.asked",
            actor: dept,
            summary: `${reason}: ${proposal.summary}`,
            evidence: notes.length === 0 ? null : notes.join(SEPARATOR),
        })
        await this.office.post(ctx, {
            dept: waiting.department,
            body: this.catalog.get("engine.ask", { dept, reason, summary: proposal.summary }, ctx.locale),
            lead_id: waiting.lead_id,
            work_item_id: waiting.id,
            installation_id: waiting.installation_id,
        })
        if (waiting.inbound_event_id !== null) {
            await this.inbound.mark(ctx, waiting.inbound_event_id, "needs_decision", waiting.lead_id)
        }
        return waiting
    }

    /**
     * Follow-up drafts keep using the existing approval card (the Office bubble, the lead page) when nothing is missing: the
     * card is created and the customer's responsibility moves to waiting for approval. Any other item keeps the card it has.
     */
    private async approvalCardFor(
        ctx: WorkContext,
        item: WorkItem,
        proposal: Proposal,
        verdict: GateVerdict,
    ): Promise<string | null> {
        if (item.action !== "send_follow_up" || verdict.missing.length > 0 || item.execution_id !== null) {
            return item.execution_id
        }
        if (item.lead_id === null) return null
        const named = proposal.fields.responsibility_id
        const responsibilityId =
            typeof named === "string" && named !== ""
                ? named
                : (await this.responsibilities.ensureFor(ctx, item.lead_id)).id
        const sales = await this.agents.agentOfDepartment(ctx.workspaceId, "sales", null)
        const card = await this.executions.open({
            workspaceId: ctx.workspaceId,
            responsibilityId,
            agentId: sales?.id ?? null,
            draft: proposal.draft ?? "",
            workItemId: item.id,
        })
        await this.responsibilities.markWaitingApproval(ctx, responsibilityId)
        return card
    }

    /** "Auto below 20,000,000 - this one 45,000,000" when the ask is because the amount reached the limit; empty otherwise. */
    private limitNote(ctx: WorkContext, rule: OptionalAuthorityRule, proposal: Proposal): string {
        const amount = proposal.amount_vnd
        const limit = rule?.limit_vnd
        if (typeof limit !== "number" || typeof amount !== "number") return ""
        if (!isOverLimit(limit, amount)) return ""
        return this.catalog.get(
            "engine.limitReached",
            { limit: formatVnd(limit, ctx.locale), amount: formatVnd(amount, ctx.locale) },
            ctx.locale,
        )
    }
}
