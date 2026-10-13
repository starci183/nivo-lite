import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { extendedPaidUntil } from "./billing.policy"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import type { BillingRow, PlanRow } from "./persistence/workspace-billing.rows"
import {
    FIND_ACTIVE_PLAN,
    FIND_BILLING,
    UPDATE_PAID_UNTIL,
    UPDATE_PLAN,
    UPDATE_STATUS,
} from "./persistence/workspace-billing.sql"
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
        const current = before.paid_until === null ? null : new Date(before.paid_until)
        const paidUntil = extendedPaidUntil(current, this.clock.now(), days).toISOString()
        await this.entityManager.query(UPDATE_PAID_UNTIL, [workspaceId, paidUntil])
        return { from: current?.toISOString() ?? null, to: paidUntil }
    }

    /** Marks the workspace active or past due; billing status only. */
    async setStatus(workspaceId: string, status: SupportStatus): Promise<BillingChange> {
        const before = await this.billingOf(workspaceId)
        await this.entityManager.query(UPDATE_STATUS, [workspaceId, status])
        return { from: before.status, to: status }
    }

    /** Moves the workspace to an active plan; paid-until is untouched, extending handles the period. */
    async setPlan(workspaceId: string, planCode: string): Promise<BillingChange> {
        const [plan] = await this.entityManager.query<Array<PlanRow>>(FIND_ACTIVE_PLAN, [planCode])
        if (plan === undefined) throw new WorkspacesError({ code: WorkspacesErrorCode.PlanUnknown })
        const before = await this.billingOf(workspaceId)
        await this.entityManager.query(UPDATE_PLAN, [workspaceId, plan.code])
        return { from: before.plan_code, to: plan.code }
    }

    private async billingOf(workspaceId: string): Promise<BillingRow> {
        const [row] = await this.entityManager.query<Array<BillingRow>>(FIND_BILLING, [workspaceId])
        if (row === undefined) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
        return row
    }
}
