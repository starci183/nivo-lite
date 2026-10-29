import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { PaymentOrderHistoryService, PaymentOrdersService } from "@modules/domain/payment-orders"
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
import { PlanEntity, PlanUsageTierEntity } from "./persistence/entities"
import { qrImageUrl } from "./sepay.policy"
import { WorkspaceAdminReadService, WorkspaceBillingService } from "@modules/domain/workspaces"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"

/** The selection with the plan's own monthly base for whatever the caller left out. */
const selectionOf = (selection: PlanSelectionInput | undefined): PlanSelection => ({
    cycle: selection?.cycle ?? "monthly",
    tierCredits: selection?.tierCredits ?? null,
    seats: selection?.seats ?? 1,
})

/** Roles that may pay for a workspace. */
/** The most workspaces one caller lists. */
const WORKSPACE_LIMIT = 200

const MANAGER_ROLES: ReadonlySet<string> = new Set(["owner", "manager"])

@Injectable()
/** Plans, who may pay for a workspace, and the payment orders a workspace asks for; every figure that charges money is read from the database. */
export class BillingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly orders: PaymentOrdersService,
        @InjectBillingOptions() private readonly options: BillingOptions,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly workspaceBilling: WorkspaceBillingService,
        private readonly workspaceReads: WorkspaceAdminReadService,
        private readonly history: PaymentOrderHistoryService,
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
        const seated = await this.seats.activeSeatsOfUser(userId, WORKSPACE_LIMIT)
        if (seated.length === 0) return []
        const ids = seated.map((seat) => seat.workspaceId)
        const [names, facts] = await Promise.all([
            this.workspaceReads.namesOf(ids, WORKSPACE_LIMIT),
            Promise.all(ids.map((id) => this.workspaceBilling.factsOf(id))),
        ])
        const nameOf = new Map(names.map((row) => [row.id, row.name]))
        return seated.flatMap((seat, at) => {
            const fact = facts[at]
            const name = nameOf.get(seat.workspaceId)
            return fact === undefined || fact === null || name === undefined
                ? []
                : [toBillingWorkspace(fact, { id: seat.workspaceId, name, role: seat.role })]
        })
    }

    /** One workspace's billing state, proving the caller's active membership through the seat. */
    async workspace(userId: string, workspaceId: string): Promise<BillingWorkspace> {
        const seat = await this.seats.activeSeatOfUser(workspaceId, userId)
        if (seat === null) throw new BillingError({ code: BillingErrorCode.NotMember })
        const [fact, [named]] = await Promise.all([
            this.workspaceBilling.factsOf(workspaceId),
            this.workspaceReads.namesOf([workspaceId], 1),
        ])
        if (fact === null || named === undefined) throw new BillingError({ code: BillingErrorCode.NotMember })
        return toBillingWorkspace(fact, { id: workspaceId, name: named.name, role: seat.role })
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
        const fact = await this.workspaceBilling.factsOf(workspaceId)
        return fact === null ? null : toWorkspaceBilling(fact)
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
        const counts = await this.history.planPaymentsOf(workspaceId)
        return { fullPricePayments: counts.fullPrice, promoPayments: counts.promo }
    }

    private async roleOf(userId: string, workspaceId: string): Promise<string | null> {
        const seat = await this.seats.activeSeatOfUser(workspaceId, userId)
        return seat === null ? null : seat.role
    }

    /** The usage tiers of every plan, smallest allowance first. */
    private tiers(): Promise<Array<PlanUsageTierEntity>> {
        return this.entityManager.find(PlanUsageTierEntity, { order: { planCode: "ASC", sort: "ASC" }, take: 500 })
    }
}
