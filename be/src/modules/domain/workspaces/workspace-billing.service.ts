import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { extendedPaidUntil } from "./billing.policy"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import type { BillingChange, SupportStatus } from "./workspaces.contracts"

@Injectable()
/** The billing facts of a workspace (status, plan, paid-until) as support changes them by hand; the only writer of those columns. */
export class WorkspaceBillingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Adds `days` to the subscription, counted from today when it already lapsed. */
    async extend(workspaceId: string, days: number): Promise<BillingChange> {
        const before = await this.billingOf(workspaceId)
        const paidUntil = extendedPaidUntil(before.paidUntil, this.clock.now(), days)
        await this.entityManager.update(WorkspaceEntity, { id: workspaceId }, { paidUntil })
        return { from: before.paidUntil?.toISOString() ?? null, to: paidUntil.toISOString() }
    }

    /** Marks the workspace active or past due; billing status only. */
    async setStatus(workspaceId: string, status: SupportStatus): Promise<BillingChange> {
        const before = await this.billingOf(workspaceId)
        await this.entityManager.update(WorkspaceEntity, { id: workspaceId }, { status })
        return { from: before.status, to: status }
    }

    /** Moves the workspace to an active plan; paid-until is untouched, extending handles the period. */
    async setPlan(workspaceId: string, planCode: string): Promise<BillingChange> {
        const plan = await this.entityManager
            .createQueryBuilder()
            .select("p.code", "code")
            .from("plans", "p")
            .where("p.code = :planCode AND p.active = true", { planCode })
            .limit(1)
            .getRawOne<{ readonly code: string }>()
        if (plan === undefined) throw new WorkspacesError({ code: WorkspacesErrorCode.PlanUnknown })
        const before = await this.billingOf(workspaceId)
        await this.entityManager.update(
            WorkspaceEntity,
            { id: workspaceId },
            { planCode: plan.code, tierCredits: null, seatCount: null },
        )
        return { from: before.planCode, to: plan.code }
    }

    private async billingOf(workspaceId: string): Promise<WorkspaceEntity> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { paidUntil: true, status: true, planCode: true },
            where: { id: workspaceId },
        })
        if (row === null) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
        return row
    }
}
