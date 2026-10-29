import { Injectable } from "@nestjs/common"
import { MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DecisionFigure, RecentDecision } from "./decisions-figures.contracts"
import { DecisionEntity } from "./persistence/entities"

@Injectable()
/** The dashboard reads of a workspace's decisions, always scoped to the workspace and bounded by the caller. */
export class DecisionsFiguresService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The decisions taken from an instant on, in no particular order. */
    async since(workspaceId: string, from: Date): Promise<Array<DecisionFigure>> {
        const decisions = await this.entityManager.find(DecisionEntity, {
            select: { workItemId: true, leadId: true, deciderKind: true, outcome: true, createdAt: true },
            where: { workspaceId, createdAt: MoreThanOrEqual(from) },
        })
        return decisions.map((decision) => ({
            workItemId: decision.workItemId,
            leadId: decision.leadId,
            deciderKind: decision.deciderKind,
            outcome: decision.outcome,
            createdAt: decision.createdAt,
        }))
    }

    /** The newest decisions, newest first, bounded by the caller. */
    async recent(workspaceId: string, limit: number): Promise<Array<RecentDecision>> {
        const decisions = await this.entityManager.find(DecisionEntity, {
            select: {
                id: true,
                workItemId: true,
                leadId: true,
                department: true,
                action: true,
                decidedBy: true,
                deciderKind: true,
                outcome: true,
                reason: true,
                note: true,
                createdAt: true,
            },
            where: { workspaceId },
            order: { createdAt: "DESC" },
            take: limit,
        })
        return decisions.map((decision) => ({
            id: decision.id,
            workItemId: decision.workItemId,
            leadId: decision.leadId,
            department: decision.department,
            action: decision.action,
            decidedBy: decision.decidedBy,
            deciderKind: decision.deciderKind,
            outcome: decision.outcome,
            reason: decision.reason,
            note: decision.note,
            createdAt: decision.createdAt,
        }))
    }
}
