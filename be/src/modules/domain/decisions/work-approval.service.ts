import { Injectable, Optional } from "@nestjs/common"
import { AuthorityRulesService, InjectWorkBranchDecider, isOverLimit } from "@modules/domain/authority-rules"
import type { WorkBranchDecider } from "@modules/domain/authority-rules"
import { ExecutionsService } from "@modules/domain/executions"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { WorkAgentDirectory } from "./work-lines.contracts"
import { WorkLinesService } from "./work-lines.service"
import type { GateVerdict, OptionalAuthorityRule, Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import type { Judgement } from "./work-engine.contracts"
import { InjectInboundEventStatus, InjectWorkAgentDirectory } from "./work-engine.decorators"
import { formatVnd } from "./work-engine.policy"
import type { InboundEventStatus } from "./work-engine.port"

/** Separates the parts of a one-line evidence text. */
const SEPARATOR = " · "

const withEvidence = (summary: string, note: string): string =>
    note === "" ? summary : `${summary}${SEPARATOR}${note}`

@Injectable()
/** Puts an item in front of a person: the waiting state, the approval card of a follow-up, and the evidence, team-chat and inbound lines. */
export class WorkApprovalService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectWorkAgentDirectory() private readonly agents: WorkAgentDirectory,
        @InjectInboundEventStatus() private readonly inbound: InboundEventStatus,
        private readonly items: WorkItemsService,
        private readonly executions: ExecutionsService,
        private readonly modules: ModuleCatalogService,
        private readonly evidence: EvidenceService,
        private readonly lines: WorkLinesService,
        private readonly rules: AuthorityRulesService,
        private readonly responsibilities: ResponsibilityJournalService,
        @Optional() @InjectWorkBranchDecider() private readonly branches?: WorkBranchDecider,
    ) {}

    /**
     * Whether an approval card will be posted for this ask: the rule names approvers (roles, rooms or members), and the card the
     * approval hook posts to their rooms is then the one message of the ask. Without approvers no card goes anywhere and the ask
     * is one line to the owner.
     */
    private async cardPosted(ctx: WorkContext, item: WorkItem): Promise<boolean> {
        const group = (await this.rules.approvalSetup(ctx.workspaceId, item.action))?.group
        return group !== undefined && group.roles.length + group.rooms.length + group.members.length > 0
    }

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

    /** The item waits for a decision; the person is told in the evidence log, the team chat and the inbound status. */
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
            this.evidenceNote(ctx, proposal),
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
        if (!(await this.cardPosted(ctx, waiting))) {
            await this.lines.say(ctx, {
                department: waiting.department,
                installationId: waiting.installation_id,
                body: this.catalog.get(
                    "engine.ask",
                    { dept, reason, summary: withEvidence(proposal.summary, this.evidenceNote(ctx, proposal)) },
                    ctx.locale,
                ),
                key: `ask:${waiting.id}`,
            })
        }
        if (judgement.branchDecisionId !== undefined) {
            await this.branches?.route({
                workspaceId: ctx.workspaceId,
                workItemId: waiting.id,
                decisionId: judgement.branchDecisionId,
            })
        }
        if (waiting.inbound_event_id !== null) {
            await this.inbound.mark(ctx, waiting.inbound_event_id, "needs_decision", waiting.lead_id)
        }
        return waiting
    }

    /**
     * Follow-up drafts keep using the existing approval card (the lead page) when nothing is missing: the
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

    /** Where what the work knows came from, in the reader's words ("the customer says", "SePay"); empty when the work does not say. */
    private evidenceNote(ctx: WorkContext, proposal: Proposal): string {
        const via = proposal.evidence?.[0]?.via
        if (via === undefined) return ""
        const key = `engine.evidenceVia.${via}`
        const words = this.catalog.get(key, {}, ctx.locale)
        return words === key ? via : words
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
