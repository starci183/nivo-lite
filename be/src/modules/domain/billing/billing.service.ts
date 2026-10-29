import { Injectable } from "@nestjs/common"
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { PaymentOrderEntity, PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectBillingOptions } from "./billing.decorators"
import type { BankAccountOptions, BillingOptions } from "./billing.options"
import type {
    BillingWorkspace,
    PayableOrder,
    Plan,
    PlanLookup,
    PlanOrderParams,
    PlanQuote,
    PlanSelection,
    PlanSelectionInput,
    RenewalParams,
    WorkspaceLookup,
} from "./billing.contracts"
import { toBillingWorkspace, toPlan, toPlanLookup, toWorkspaceBilling } from "./billing.mapper"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { quoteSelection } from "./pricing.policy"
import type { PromoHistory } from "./pricing.policy"
import type { BillingWorkspaceRead, PromoHistoryRead, WorkspaceBillingRead } from "./billing-reads.contracts"
import { PlanEntity, PlanUsageTierEntity } from "./persistence/entities"
import { qrImageUrl } from "./sepay.policy"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"

/** The selection with the plan's own monthly base for whatever the caller left out. */
const selectionOf = (selection: PlanSelectionInput | undefined): PlanSelection => ({
    cycle: selection?.cycle ?? "monthly",
    tierCredits: selection?.tierCredits ?? null,
    seats: selection?.seats ?? 1,
})

/** Roles that may pay for a workspace. */
const MANAGER_ROLES: ReadonlySet<string> = new Set(["owner", "manager"])

@Injectable()
/** Plans, who may pay for a workspace, and the payment orders a workspace asks for; every figure that charges money is read from the database. */
export class BillingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly orders: PaymentOrdersService,
        @InjectBillingOptions() private readonly options: BillingOptions,
    ) {}

    /** The configured recipient account, available before a workspace creates a payment order. */
    bankAccount(): Promise<BankAccountOptions> {
        return Promise.resolve({ ...this.options.bankAccount })
    }

    /** The plans on sale in display order, each with its usage tiers. */
    async listPlans(): Promise<Array<Plan>> {
        const rows = await this.entityManager.find(PlanEntity, {
            where: { active: true, listed: true },
            order: { sort: "ASC" },
            take: 100,
        })
        const tiers = await this.tiers()
        return rows.map((row) => toPlan(row, tiers))
    }

    /** The caller's active workspaces and billing state; the user id is taken only from the verified principal. */
    async workspaces(userId: string): Promise<Array<BillingWorkspace>> {
        const rows = await this.billingWorkspaces(userId)
            .orderBy("w.created_at", "DESC")
            .limit(200)
            .getRawMany<BillingWorkspaceRead>()
        return rows.map(toBillingWorkspace)
    }

    /** One workspace's billing state, proving the caller's active membership through the selected row. */
    async workspace(userId: string, workspaceId: string): Promise<BillingWorkspace> {
        const row = await this.billingWorkspaces(userId)
            .andWhere("w.id = :workspaceId", { workspaceId })
            .limit(1)
            .getRawOne<BillingWorkspaceRead>()
        if (row === undefined) throw new BillingError({ code: BillingErrorCode.NotMember })
        return toBillingWorkspace(row)
    }

    /** One active plan with its usage tiers (on sale or not), or null when no active plan has the code. */
    async findPlan(code: string): Promise<PlanLookup> {
        const plan = await this.entityManager.findOne(PlanEntity, { where: { code, active: true } })
        if (plan === null) return null
        return toPlanLookup([plan], await this.tiers())
    }

    /** One active plan; refuses a code that names none. */
    async requirePlan(code: string): Promise<Plan> {
        const plan = await this.findPlan(code)
        if (plan === null) throw new BillingError({ code: BillingErrorCode.PlanNotFound, params: { plan: code } })
        return plan
    }

    /** The billing columns of a workspace, or null when it does not exist. */
    async findWorkspaceBilling(workspaceId: string): Promise<WorkspaceLookup> {
        const row = await this.entityManager
            .createQueryBuilder(WorkspaceEntity, "w")
            .select(["w.status AS status", "w.plan_code AS plan_code", "w.paid_until AS paid_until"])
            .addSelect("w.tier_credits::float8", "tier_credits")
            .addSelect("w.seat_count", "seat_count")
            .addSelect("w.billing_cycle", "billing_cycle")
            .addSelect("w.billed_monthly_vnd::float8", "billed_monthly_vnd")
            .where("w.id = :workspaceId", { workspaceId })
            .limit(1)
            .getRawOne<WorkspaceBillingRead>()
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
        if (role === null || !MANAGER_ROLES.has(role)) throw new BillingError({ code: BillingErrorCode.Forbidden })
    }

    /** "Renew": a new payment order for what the workspace has now - same plan, usage tier, seats and cycle (owner or manager). */
    async renew(userId: string, params: RenewalParams): Promise<PayableOrder> {
        await this.requireManager(userId, params.workspaceId)
        const workspace = await this.findWorkspaceBilling(params.workspaceId)
        if (workspace?.planCode == null) {
            throw new BillingError({ code: BillingErrorCode.WorkspaceNotFound })
        }
        return this.orderPlanOf(userId, params.workspaceId, workspace.planCode, {
            cycle: workspace.billingCycle ?? "monthly",
            tierCredits: workspace.tierCredits,
            seats: workspace.seatCount ?? 1,
        })
    }

    /** The first payment of a workspace for the plan it chose, with the cycle, usage tier and seats (owner or manager). */
    async orderPlan(userId: string, params: PlanOrderParams): Promise<PayableOrder> {
        await this.requireManager(userId, params.workspaceId)
        await this.requireListed(params.workspaceId, params.planCode)
        return this.orderPlanOf(userId, params.workspaceId, params.planCode, params.selection)
    }

    /** What a plan selection costs this workspace right now (any member): the intro price shows only while it still applies. */
    async quote(userId: string, params: PlanOrderParams): Promise<PlanQuote> {
        await this.requireMember(userId, params.workspaceId)
        await this.requireListed(params.workspaceId, params.planCode)
        const plan = await this.requirePlan(params.planCode)
        return quoteSelection(plan, selectionOf(params.selection), await this.promoHistory(params.workspaceId))
    }

    /** An order together with the VietQR image and the bank account that pay it. */
    payable(order: PaymentOrder): PayableOrder {
        return {
            order,
            qrUrl: qrImageUrl(this.options.bankAccount, order.amountVnd, order.orderCode),
            bank: this.options.bankAccount,
        }
    }

    private async orderPlanOf(
        userId: string,
        workspaceId: string,
        planCode: string,
        selection: PlanSelectionInput | undefined,
    ): Promise<PayableOrder> {
        const plan = await this.requirePlan(planCode)
        const quote = quoteSelection(plan, selectionOf(selection), await this.promoHistory(workspaceId))
        const order = await this.orders.create({
            workspaceId,
            userId,
            planCode: plan.code,
            amountVnd: quote.amountVnd,
            kind: "plan",
            packCode: null,
            detail: {
                cycle: quote.cycle,
                months: quote.months,
                tierCredits: quote.tierCredits ?? 0,
                seats: quote.seats,
                promo: quote.promo,
                listMonthlyVnd: quote.listMonthlyVnd,
            },
        })
        return this.payable(order)
    }

    /** A plan that is no longer sold can only be paid again by the workspace that has it. */
    private async requireListed(workspaceId: string, planCode: string): Promise<void> {
        const plan = await this.requirePlan(planCode)
        if (plan.listed) return
        const workspace = await this.findWorkspaceBilling(workspaceId)
        if (workspace?.planCode !== plan.code) {
            throw new BillingError({ code: BillingErrorCode.PlanNotListed, params: { plan: plan.code } })
        }
    }

    private async promoHistory(workspaceId: string): Promise<PromoHistory> {
        const row = await this.entityManager
            .createQueryBuilder(PaymentOrderEntity, "o")
            .select("count(*) FILTER (WHERE COALESCE(o.detail ->> 'promo', 'false') <> 'true')::int", "full_price")
            .addSelect("count(*) FILTER (WHERE o.detail ->> 'promo' = 'true')::int", "promo")
            .where("o.workspace_id = :workspaceId AND o.kind = 'plan' AND o.status = 'paid'", { workspaceId })
            .getRawOne<PromoHistoryRead>()
        return { fullPricePayments: row?.full_price ?? 0, promoPayments: row?.promo ?? 0 }
    }

    private async roleOf(userId: string, workspaceId: string): Promise<string | null> {
        const member = await this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .select("m.role", "role")
            .where("m.workspace_id = :workspaceId AND m.user_id = :userId AND m.status = 'active'", {
                workspaceId,
                userId,
            })
            .limit(1)
            .getRawOne<{ role: string }>()
        return member === undefined ? null : member.role
    }

    /** The usage tiers of every plan, smallest allowance first. */
    private tiers(): Promise<Array<PlanUsageTierEntity>> {
        return this.entityManager.find(PlanUsageTierEntity, { order: { planCode: "ASC", sort: "ASC" }, take: 500 })
    }

    /** The caller's active memberships joined to their workspaces, as the billing columns of each. */
    private billingWorkspaces(userId: string): SelectQueryBuilder<ObjectLiteral> {
        return this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .select(["w.id AS id", "w.name AS name", "w.status AS status", "w.plan_code AS plan_code"])
            .addSelect("w.paid_until", "paid_until")
            .addSelect("w.tier_credits::float8", "tier_credits")
            .addSelect("w.seat_count", "seat_count")
            .addSelect("w.billing_cycle", "billing_cycle")
            .addSelect("w.billed_monthly_vnd::float8", "billed_monthly_vnd")
            .addSelect("m.role", "role")
            .innerJoin(WorkspaceEntity, "w", "w.id = m.workspace_id")
            .where("m.user_id = :userId AND m.status = 'active'", { userId })
    }
}
