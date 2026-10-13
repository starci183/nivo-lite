import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApprovalGate } from "@modules/domain/module-ops"
import type { ApprovalDecision, ModuleApprovalRequest, ModuleApprovalResult } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { Locale } from "@modules/platform/i18n"
import type { Decider, WorkContext, WorkItem } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { proposalOf, subjectTypeOf } from "./module-gate.policy"
import type { WorkItemViewRow } from "./persistence/work-item-views.rows"
import { FIND_WORK_ITEM_VIEW } from "./persistence/work-item-views.sql"
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
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
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
            origin: "live",
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
        return deciderOf(await this.members.require(decision.decidedBy, decision.workspaceId))
    }

    private async current(decision: ApprovalDecision): Promise<ModuleApprovalResult> {
        const [row] = await this.entityManager.query<Array<WorkItemViewRow>>(FIND_WORK_ITEM_VIEW, [
            decision.workspaceId,
            decision.workItemId,
        ])
        if (row === undefined) throw new DecisionsError({ code: DecisionsErrorCode.NotFound })
        return resultOf(row)
    }
}
