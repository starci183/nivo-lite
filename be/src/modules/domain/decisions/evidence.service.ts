import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DecisionEntry, EvidenceEntry, WorkContext } from "./decisions.contracts"
import { DecisionEntity } from "./persistence/entities"

@Injectable()
/** The two append-only logs: the evidence log of what happened and the decision log of who decided what. */
export class EvidenceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly events: EventsService,
    ) {}

    /** Appends one line to the workspace's evidence log; the events capability is its only writer. */
    async log(ctx: WorkContext, entry: EvidenceEntry, manager: EntityManager = this.entityManager): Promise<void> {
        await this.events.record(
            {
                workspaceId: ctx.workspaceId,
                kind: entry.kind,
                actor: entry.actor,
                summary: entry.summary,
                leadId: entry.lead_id ?? null,
                workItemId: entry.work_item_id ?? null,
                evidence: entry.evidence ?? null,
            },
            manager,
        )
    }

    /** Appends one line to the decision log: who decided, how (policy or person), the outcome and why. */
    async decide(ctx: WorkContext, entry: DecisionEntry, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.insert(DecisionEntity, {
            workspaceId: ctx.workspaceId,
            workItemId: entry.work_item_id,
            leadId: entry.lead_id,
            department: entry.department,
            action: entry.action,
            decidedBy: entry.decided_by,
            deciderKind: entry.decider_kind,
            outcome: entry.outcome,
            reason: entry.reason ?? null,
            note: entry.note ?? null,
            before: entry.before ?? null,
            after: entry.after ?? null,
            decidedByMemberId: entry.decided_by_member_id ?? null,
        })
    }
}
