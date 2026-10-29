import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { extendedPaidUntil } from "./billing.policy"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import type { BillingChange, OptionalActivePlan, OptionalBillingFacts, SupportStatus } from "./workspaces.contracts"

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

    /**
     * Moves the workspace to an active plan; paid-until is untouched, extending handles the period. The caller proves the plan with the
     * capability that owns plans and hands it over; none (an unknown or retired plan) is refused.
     */
    async setPlan(workspaceId: string, plan: OptionalActivePlan): Promise<BillingChange> {
        if (plan === null) throw new WorkspacesError({ code: WorkspacesErrorCode.PlanUnknown })
        const before = await this.billingOf(workspaceId)
        await this.entityManager.update(
            WorkspaceEntity,
            { id: workspaceId },
            { planCode: plan.code, tierCredits: null, seatCount: null },
        )
        return { from: before.planCode, to: plan.code }
    }

    /** The billing columns of a workspace for the billing capability; null when there is no such workspace. */
    async factsOf(workspaceId: string): Promise<OptionalBillingFacts> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: {
                status: true,
                planCode: true,
                paidUntil: true,
                tierCredits: true,
                seatCount: true,
                billingCycle: true,
                billedMonthlyVnd: true,
            },
            where: { id: workspaceId },
        })
        if (row === null) return null
        return {
            status: row.status,
            planCode: row.planCode,
            paidUntil: row.paidUntil,
            tierCredits: row.tierCredits === null ? null : Number(row.tierCredits),
            seatCount: row.seatCount,
            billingCycle: row.billingCycle,
            billedMonthlyVnd: row.billedMonthlyVnd === null ? null : Number(row.billedMonthlyVnd),
        }
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
