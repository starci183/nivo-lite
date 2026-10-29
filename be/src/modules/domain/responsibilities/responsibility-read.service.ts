import { Injectable } from "@nestjs/common"
import { ILike, In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ResponsibilityEntity } from "./persistence/entities"
import type { ResponsibilityLead, ResponsibilitySheet } from "./responsibility-read.contracts"

/** A stored step as the readers of other capabilities see it. */
const sheetOf = (step: ResponsibilityEntity): ResponsibilitySheet => ({
    id: step.id,
    leadId: step.leadId,
    title: step.title,
    ownerKind: step.ownerKind,
    ownerAgentId: step.ownerAgentId,
    ownerName: step.ownerName,
    nextAction: step.nextAction,
    dueAt: step.dueAt,
    status: step.status,
    createdAt: step.createdAt,
})

@Injectable()
/** Request-time reads of the steps for other capabilities (dashboards), always scoped to the workspace and bounded by the caller. */
export class ResponsibilityReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The steps of the workspace, due soonest first (steps without a due date last), bounded by the caller. */
    async dueSoonest(workspaceId: string, limit: number): Promise<Array<ResponsibilitySheet>> {
        const steps = await this.entityManager.find(ResponsibilityEntity, {
            where: { workspaceId },
            order: { dueAt: { direction: "ASC", nulls: "LAST" } },
            take: limit,
        })
        return steps.map(sheetOf)
    }

    /** The given steps of the workspace (a missing step is missing from the answer). */
    async stepsOf(workspaceId: string, responsibilityIds: ReadonlyArray<string>): Promise<Array<ResponsibilitySheet>> {
        if (responsibilityIds.length === 0) return []
        const steps = await this.entityManager.find(ResponsibilityEntity, {
            where: { workspaceId, id: In([...new Set(responsibilityIds)]) },
        })
        return steps.map(sheetOf)
    }

    /** The customer of each of the given steps (a missing step is missing from the answer). */
    async leadsOf(workspaceId: string, responsibilityIds: ReadonlyArray<string>): Promise<Array<ResponsibilityLead>> {
        if (responsibilityIds.length === 0) return []
        const steps = await this.entityManager.find(ResponsibilityEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId, id: In([...new Set(responsibilityIds)]) },
        })
        return steps.map((step) => ({ id: step.id, leadId: step.leadId }))
    }

    /** The ids of the steps whose title matches any of the (case-insensitive) LIKE patterns, bounded by the caller. */
    async idsTitledLike(workspaceId: string, patterns: ReadonlyArray<string>, limit: number): Promise<Array<string>> {
        if (patterns.length === 0) return []
        const steps = await this.entityManager.find(ResponsibilityEntity, {
            select: { id: true },
            where: patterns.map((pattern) => ({ workspaceId, title: ILike(pattern) })),
            take: limit,
        })
        return steps.map((step) => step.id)
    }
}
