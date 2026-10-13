import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BillingService } from "@modules/domain/billing"
import type { PayableOrder, Plan } from "@modules/domain/billing"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import { UsageService } from "@modules/domain/usage"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { addDays, vietnamDay } from "./calendar.policy"
import type {
    CreditPack,
    CreditsOverview,
    PackLookup,
    TopupParams,
    UpgradeOrder,
    UpgradeParams,
} from "./credits.contracts"
import { toCreditPack, toTopupLot } from "./credits.mapper"
import { CreditsError, CreditsErrorCode } from "./errors/credits.error"
import { overviewOf } from "./overview.policy"
import type { LotRow, PackRow } from "./persistence/credits.rows"
import { SELECT_ACTIVE_PACKS, SELECT_TOPUP_LOTS } from "./persistence/credits.sql"
import { prorateUpgrade } from "./proration.policy"

/** How many payment orders the overview lists. */
const ORDER_LIST_SIZE = 50

@Injectable()
/** Credit top-ups and plan upgrades: the figures that charge money are computed here from the database, never taken from the caller. */
export class CreditsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly billing: BillingService,
        private readonly orders: PaymentOrdersService,
        private readonly usage: UsageService,
    ) {}

    /** The packs on sale in display order. */
    async listPacks(): Promise<Array<CreditPack>> {
        const rows = await this.entityManager.query<Array<PackRow>>(SELECT_ACTIVE_PACKS)
        return rows.map(toCreditPack)
    }

    /** A pending top-up order for one pack (owner or manager); the same open order when it was just asked for. */
    async topup(userId: string, params: TopupParams): Promise<PayableOrder> {
        await this.billing.requireManager(userId, params.workspaceId)
        const pack = await this.requirePack(params.packCode)
        const plan = await this.requireActivePlan(params.workspaceId, ["active", "past_due"])
        const existing = await this.orders.findOpenTopup({
            workspaceId: params.workspaceId,
            target: pack.code,
            amountVnd: pack.priceVnd,
        })
        if (existing !== null) return this.billing.payable(existing)
        const order = await this.orders.create({
            workspaceId: params.workspaceId,
            userId,
            planCode: plan.code,
            amountVnd: pack.priceVnd,
            kind: "topup",
            packCode: pack.code,
            detail: { credits: pack.credits },
        })
        return this.billing.payable(order)
    }

    /**
     * A pending upgrade order to a higher self-serve plan (owner or manager). The workspace must be active and inside its paid
     * period; the amount is the target price minus the unused value of the current plan. Paying switches the plan at once and keeps
     * paid_until (settle_payment_order).
     */
    async upgrade(userId: string, params: UpgradeParams): Promise<UpgradeOrder> {
        await this.billing.requireManager(userId, params.workspaceId)
        const current = await this.requireActivePlan(params.workspaceId, ["active"])
        const target = await this.billing.findPlan(params.planCode)
        if (target === null || current.isCustom || target.isCustom) throw new CreditsError({ code: CreditsErrorCode.NotUpgrade })
        if (target.sort <= current.sort || target.priceVnd <= current.priceVnd) {
            throw new CreditsError({ code: CreditsErrorCode.NotUpgrade })
        }
        const workspace = await this.billing.findWorkspaceBilling(params.workspaceId)
        const now = this.clock.now()
        if (workspace?.paidUntil == null || new Date(workspace.paidUntil).getTime() <= now.getTime()) {
            throw new CreditsError({ code: CreditsErrorCode.RenewFirst })
        }
        const quote = prorateUpgrade({
            currentPrice: current.priceVnd,
            targetPrice: target.priceVnd,
            paidUntil: workspace.paidUntil,
            now,
        })
        if (quote.amount <= 0) throw new CreditsError({ code: CreditsErrorCode.ZeroAmount })
        const upgradeQuote = { ...quote, fromCode: current.code }
        const existing = await this.orders.findOpenUpgrade({
            workspaceId: params.workspaceId,
            target: target.code,
            amountVnd: quote.amount,
        })
        if (existing !== null) return { payable: this.billing.payable(existing), quote: upgradeQuote }
        const order = await this.orders.create({
            workspaceId: params.workspaceId,
            userId,
            planCode: target.code,
            amountVnd: quote.amount,
            kind: "upgrade",
            packCode: null,
            detail: {
                from: current.code,
                to: target.code,
                fromPrice: current.priceVnd,
                toPrice: target.priceVnd,
                credit: quote.credit,
                daysLeft: quote.daysLeft,
                paidUntil: workspace.paidUntil,
            },
        })
        return { payable: this.billing.payable(order), quote: upgradeQuote }
    }

    /** Everything the credits page shows for a workspace; any member may read it, only owner and manager get `canBuy`. */
    async overview(userId: string, workspaceId: string): Promise<CreditsOverview> {
        const canBuy = await this.billing.canManage(userId, workspaceId)
        const now = this.clock.now()
        const today = vietnamDay(now)
        const [workspace, plans, packs, status, orders, lotRows, last7CostUsd] = await Promise.all([
            this.billing.findWorkspaceBilling(workspaceId),
            this.billing.listPlans(),
            this.listPacks(),
            this.usage.quotaStatus(workspaceId),
            this.orders.listRecent(workspaceId, ORDER_LIST_SIZE),
            this.entityManager.query<Array<LotRow>>(SELECT_TOPUP_LOTS, [workspaceId]),
            this.usage.costSince(workspaceId, addDays(today, -6)),
        ])
        if (workspace === null) throw new CreditsError({ code: CreditsErrorCode.WorkspaceNotActive })
        return overviewOf({
            canBuy,
            workspace,
            plans,
            packs,
            status,
            orders,
            lots: lotRows.map(toTopupLot),
            last7CostUsd,
            today,
            now,
            bank: this.billing.bankAccount(),
        })
    }

    private async requirePack(code: string): Promise<CreditPack> {
        const packs = await this.listPacks()
        const pack: PackLookup = packs.find((candidate) => candidate.code === code) ?? null
        if (pack === null) throw new CreditsError({ code: CreditsErrorCode.PackNotFound })
        return pack
    }

    /** The plan of a workspace whose status is one of `statuses`; refuses a workspace that is not, or whose plan is gone. */
    private async requireActivePlan(workspaceId: string, statuses: ReadonlyArray<string>): Promise<Plan> {
        const workspace = await this.billing.findWorkspaceBilling(workspaceId)
        if (workspace === null || workspace.planCode === null || !statuses.includes(workspace.status)) {
            throw new CreditsError({ code: CreditsErrorCode.WorkspaceNotActive })
        }
        const plan = await this.billing.findPlan(workspace.planCode)
        if (plan === null) throw new CreditsError({ code: CreditsErrorCode.PlanNotFound })
        return plan
    }
}
