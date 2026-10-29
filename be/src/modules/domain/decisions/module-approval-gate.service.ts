import { Injectable } from "@nestjs/common"
import { ApprovalGate } from "@modules/domain/module-ops"
import type { ApprovalDecision, ModuleApprovalRequest, ModuleApprovalResult } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { Locale } from "@modules/platform/i18n"
import type { Decider, WorkContext, WorkItem } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { proposalOf, subjectTypeOf } from "./module-gate.policy"
import { WorkItemViewsService } from "./work-item-views.service"
import { deciderOf } from "./work-decision.policy"
import { WorkEngineService } from "./work-engine.service"

/** The business modules write their texts in Vietnamese. */
const MODULE_LOCALE: Locale = "vi"

const resultOf = (item: Pick<WorkItem, "id" | "status">): ModuleApprovalResult => ({
    status: item.status,
    workItemId: item.id,
})

@Injectable()
/**
 * The approval gate of the business modules over the work engine: a request becomes a preset work item that the owner's rule
 * runs at once or puts in front of a person, and a module's own decision (a cancel) resumes the same item.
 */
export class ModuleApprovalGateService extends ApprovalGate {
    constructor(
        private readonly engine: WorkEngineService,
        private readonly members: WorkspaceMembersService,
        private readonly views: WorkItemViewsService,
    ) {
        super()
    }

    /** Runs the action through the gate; a repeated dedupe key answers the item it made before. */
    override async request(request: ModuleApprovalRequest): Promise<ModuleApprovalResult> {
        const ctx: WorkContext = { workspaceId: request.workspaceId, actor: request.actor, locale: MODULE_LOCALE }
        const item = await this.engine.runWork(ctx, {
            action: request.action,
            subject_type: subjectTypeOf(request.subjectType),
            subject_id: request.subjectId,
            dedupeKey: request.dedupeKey,
            preset: true,
            seed: proposalOf(request),
        })
        return resultOf(item)
    }

    /** Resumes a waiting item with the decision; an item no longer waiting answers its current status. */
    override async decide(decision: ApprovalDecision): Promise<ModuleApprovalResult> {
        const by = await this.deciderOf(decision)
        const ctx: WorkContext = { workspaceId: decision.workspaceId, actor: by.name, locale: MODULE_LOCALE }
        try {
            return resultOf(await this.engine.resumeWork(ctx, decision.workItemId, decision.decision, {}, by))
        } catch (cause) {
            if (!(cause instanceof DecisionsError) || cause.code !== DecisionsErrorCode.NotWaiting) throw cause
            return this.current(decision)
        }
    }

    /** The member behind the decision, looked up by user id for the name and role. */
    private async deciderOf(decision: ApprovalDecision): Promise<Decider> {
        const member = await this.members.require(decision.decidedBy, decision.workspaceId)
        return deciderOf(member, await this.members.idOf(decision.decidedBy, decision.workspaceId))
    }

    private async current(decision: ApprovalDecision): Promise<ModuleApprovalResult> {
        const row = await this.views.find(decision.workspaceId, decision.workItemId)
        if (row === undefined) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        return resultOf(row)
    }
}
