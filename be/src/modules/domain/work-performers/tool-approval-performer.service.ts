import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { ThreadRunsService } from "@modules/domain/agent-threads"
// Deep import until the folder's index exports the approvals (request to P4 under "PHASE1 wiring → P4"); then one import above.
import {
    ThreadApprovalsService,
    THREAD_APPROVAL_ENGINE,
    TOOL_APPROVAL_ACTION,
} from "@modules/domain/agent-threads/thread-approvals.service"
import { InjectWorkPerformerRegistry, ModuleCatalogService } from "@modules/domain/decisions"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { textOf } from "./performer.policy"

/** The role that alone may approve a call of an ability ticked `ask`. */
const OWNER_ROLE = "owner"

/** The member behind a decision, or null for the engine (a deadline) or a decider no seat stands for. */
const memberOf = (by: PerformedBy): string | null => ("memberId" in by && by.memberId !== undefined ? by.memberId : null)

/** True for the item of a thread run's approval stop; every other item of the action is the old engine's. */
const isThreadItem = (proposal: Proposal): boolean => proposal.fields.engine === THREAD_APPROVAL_ENGINE

@Injectable()
/**
 * `approve_tool_call`: the owner's verdict on ONE tool call a workflow step asked for (an ability on a connected account ticked `ask`).
 * For a THREAD run (the item names engine `langgraph`) the verdict goes to the run's approval stop and the thread runs resume it: only
 * the workspace OWNER may approve (anyone else's approval is refused and the item does not pass), a refusal by any decider or by the
 * deadline runs the step again with the refusal. For an item of the old engine nothing changes: it records the decision, exactly as the
 * action did with no performer, and the old run's wait step reads the verdict from the closed item.
 */
export class ToolApprovalPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @Optional() private readonly approvals?: ThreadApprovalsService,
        @Optional() private readonly runs?: ThreadRunsService,
        @Optional() private readonly seats?: WorkspaceMemberSeatsService,
        @Optional() private readonly modules?: ModuleCatalogService,
    ) {}

    /** Registers with the work engine once the app has started. */
    onModuleInit(): void {
        this.registry.add(TOOL_APPROVAL_ACTION, this)
    }

    /** The proposal is preset by the step that asked. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** The owner approved: the thread runs the step again with the approval of exactly the call shown; the old engine's item only records. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        if (!isThreadItem(proposal)) return this.recorded(ctx, item)
        const memberId = memberOf(by)
        if (memberId === null || !(await this.isOwner(ctx.workspaceId, memberId)))
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalNotOwner, params: { item: item.id } })
        await this.hand(ctx, item, proposal, "approved", memberId)
        return { summary: proposal.summary, evidence: "captured", lead_id: item.lead_id }
    }

    /** A person refused, or the deadline passed: the thread runs the step again with the refusal; the old engine's item is left as it was. */
    async onReject(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<void> {
        if (!isThreadItem(proposal)) return
        await this.hand(ctx, item, proposal, "refused", memberOf(by))
    }

    /** Hands the verdict to the run's approval stop; a run that no longer waits on this item refuses it and the item does not pass. */
    private async hand(
        ctx: WorkContext,
        item: WorkItem,
        proposal: Proposal,
        verdict: "approved" | "refused",
        by: string | null,
    ): Promise<void> {
        const runId = textOf(proposal.fields.runId)
        const stepKey = textOf(proposal.fields.stepKey)
        if (runId === "" || stepKey === "" || this.approvals === undefined || this.runs === undefined)
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
        const tool = textOf(proposal.fields.tool)
        const decided = await this.approvals.decided(
            {
                workspaceId: ctx.workspaceId,
                runId,
                stepKey,
                workItemId: item.id,
                verdict,
                by,
                text: this.catalog.get("performers.toolApprovalRefused", { tool }, ctx.locale),
            },
            this.runs,
        )
        // A refusal of an item whose run moved on (skipped, ended) is still the person's refusal: nothing waits to be told.
        if (decided.kind === "refused" && verdict === "approved")
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
    }

    /** The active owner seat of the workspace, and only it: a manager or staff approval does not pass. */
    private async isOwner(workspaceId: string, memberId: string): Promise<boolean> {
        const seat = await this.seats?.seatById(workspaceId, memberId)
        return seat?.role === OWNER_ROLE && seat.status === "active"
    }

    /** What the work engine answers for an action with no performer: the decision is recorded, nothing is done. */
    private async recorded(ctx: WorkContext, item: WorkItem): Promise<Performed> {
        const action = (await this.modules?.actionOf(item.action))?.label[ctx.locale] ?? item.action
        return {
            summary: this.catalog.get("engine.recordOnly", { action }, ctx.locale),
            evidence: "pending",
            lead_id: item.lead_id,
        }
    }
}
