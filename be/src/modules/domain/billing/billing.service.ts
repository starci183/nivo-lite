import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectBillingOptions } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import type {
    PayableOrder,
    Plan,
    PlanLookup,
    PlanOrderParams,
    RenewalParams,
    WorkspaceLookup,
} from "./billing.contracts"
import { toPlan, toWorkspaceBilling } from "./billing.mapper"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import type { MemberRoleRow, PlanRow, WorkspaceBillingRow } from "./persistence/billing.rows"
import {
    SELECT_ACTIVE_PLANS,
    SELECT_MEMBER_ROLE,
    SELECT_PLAN,
    SELECT_WORKSPACE_BILLING,
} from "./persistence/billing.sql"
import { qrImageUrl } from "./sepay.policy"

/** Roles that may pay for a workspace. */
const MANAGER_ROLES: ReadonlyArray<string> = ["owner", "manager"]

@Injectable()
/** Plans, who may pay for a workspace, and the payment orders a workspace asks for; every figure that charges money is read from the database. */
export class BillingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly orders: PaymentOrdersService,
        @InjectBillingOptions() private readonly options: BillingOptions,
    ) {}

    /** The active plans of the catalogue in display order. */
    async listPlans(): Promise<Array<Plan>> {
        const rows = await this.entityManager.query<Array<PlanRow>>(SELECT_ACTIVE_PLANS)
        return rows.map(toPlan)
    }

    /** One active plan, or null when no active plan has the code. */
    async findPlan(code: string): Promise<PlanLookup> {
        const [row] = await this.entityManager.query<Array<PlanRow>>(SELECT_PLAN, [code])
        return row === undefined ? null : toPlan(row)
    }

    /** One active plan; refuses a code that names none. */
    async requirePlan(code: string): Promise<Plan> {
        const plan = await this.findPlan(code)
        if (plan === null) throw new BillingError({ code: BillingErrorCode.PlanNotFound, params: { plan: code } })
        return plan
    }

    /** The billing columns of a workspace, or null when it does not exist. */
    async findWorkspaceBilling(workspaceId: string): Promise<WorkspaceLookup> {
        const [row] = await this.entityManager.query<Array<WorkspaceBillingRow>>(SELECT_WORKSPACE_BILLING, [
            workspaceId,
        ])
        return row === undefined ? null : toWorkspaceBilling(row)
    }

    /** Refuses anyone who is not an active member of the workspace. */
    async requireMember(userId: string, workspaceId: string): Promise<void> {
        const role = await this.roleOf(userId, workspaceId)
        if (role === null) throw new BillingError({ code: BillingErrorCode.NotMember })
    }

    /** Refuses anyone who is not an active owner or manager of the workspace. */
    async requireManager(userId: string, workspaceId: string): Promise<void> {
        const role = await this.roleOf(userId, workspaceId)
        if (role === null || !MANAGER_ROLES.includes(role)) throw new BillingError({ code: BillingErrorCode.Forbidden })
    }

    /** "Renew": a new payment order for the current plan of the workspace (owner or manager). */
    async renew(userId: string, params: RenewalParams): Promise<PayableOrder> {
        await this.requireManager(userId, params.workspaceId)
        const workspace = await this.findWorkspaceBilling(params.workspaceId)
        if (workspace === null || workspace.planCode === null) {
            throw new BillingError({ code: BillingErrorCode.WorkspaceNotFound })
        }
        return this.orderPlanOf(userId, params.workspaceId, workspace.planCode)
    }

    /** The first payment of a workspace for the plan it chose (owner or manager). */
    async orderPlan(userId: string, params: PlanOrderParams): Promise<PayableOrder> {
        await this.requireManager(userId, params.workspaceId)
        return this.orderPlanOf(userId, params.workspaceId, params.planCode)
    }

    /** An order together with the VietQR image and the bank account that pay it. */
    payable(order: PaymentOrder): PayableOrder {
        return {
            order,
            qrUrl: qrImageUrl(this.options.bankAccount, order.amountVnd, order.orderCode),
            bank: this.options.bankAccount,
        }
    }

    private async orderPlanOf(userId: string, workspaceId: string, planCode: string): Promise<PayableOrder> {
        const plan = await this.requirePlan(planCode)
        if (plan.isCustom) throw new BillingError({ code: BillingErrorCode.PlanCustom })
        const order = await this.orders.create({
            workspaceId,
            userId,
            planCode: plan.code,
            amountVnd: plan.priceVnd,
            kind: "plan",
            packCode: null,
            detail: {},
        })
        return this.payable(order)
    }

    private async roleOf(userId: string, workspaceId: string): Promise<string | null> {
        const [member] = await this.entityManager.query<Array<MemberRoleRow>>(SELECT_MEMBER_ROLE, [workspaceId, userId])
        return member === undefined ? null : member.role
    }
}
