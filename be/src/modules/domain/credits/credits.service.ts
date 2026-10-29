import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BillingService } from "@modules/domain/billing"
import type { PayableOrder, Plan } from "@modules/domain/billing"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    CreditPack,
    CreditPackParams,
    CreditPackPurchase,
    CreditTopupLot,
    PackLookup,
    TopupParams,
    UpgradeOrder,
    UpgradeParams,
} from "./credits.contracts"
import { toCreditPack, toCreditPackPurchase, toCreditTopupLot } from "./credits.mapper"
import { CreditsError, CreditsErrorCode } from "./errors/credits.error"
import { CreditPackEntity, CreditPackPurchaseEntity, CreditTopupEntity } from "./persistence/entities"
import { prorateUpgrade } from "./proration.policy"

@Injectable()
/** Credit top-ups and plan upgrades: the figures that charge money are computed here from the database, never taken from the caller. */
export class CreditsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly billing: BillingService,
        private readonly orders: PaymentOrdersService,
    ) {}

    /** The packs on sale in display order. */
    async listPacks(): Promise<Array<CreditPack>> {
        const rows = await this.entityManager.find(CreditPackEntity, {
            where: { active: true },
            order: { sort: "ASC" },
            take: 50,
        })
        return rows.map(toCreditPack)
    }

    /** The latest purchased lots of a workspace, proving the caller's owner or manager role. */
    async topupLots(userId: string, workspaceId: string): Promise<ReadonlyArray<CreditTopupLot>> {
        await this.billing.requireManager(userId, workspaceId)
        const rows = await this.entityManager.find(CreditTopupEntity, {
            where: { workspaceId },
            order: { purchasedAt: "DESC" },
            take: 200,
        })
        return rows.map(toCreditTopupLot)
    }

    /** The add-on packs a workspace paid for this month, for any member. */
    async packsBought(userId: string, workspaceId: string): Promise<ReadonlyArray<CreditPackPurchase>> {
        await this.billing.requireMember(userId, workspaceId)
        const rows = await this.entityManager
            .createQueryBuilder(CreditPackPurchaseEntity, "p")
            .where("p.workspaceId = :workspaceId", { workspaceId })
            .andWhere("p.period = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date")
            .orderBy("p.purchasedAt", "DESC")
            .limit(200)
            .getMany()
        return rows.map(toCreditPackPurchase)
    }

    /**
     * A pending order for one add-on pack of the workspace's plan (owner or manager); the same open order when it was just asked for.
     * The pack adds its credits to the month it is paid in; it never changes the plan price and can be bought again.
     */
    async creditPack(userId: string, params: CreditPackParams): Promise<PayableOrder> {
        await this.billing.requireManager(userId, params.workspaceId)
        const plan = await this.requireActivePlan(params.workspaceId, ["active", "past_due"])
        const pack = plan.packs.find((candidate) => candidate.creditsPerMonth === params.credits)
        if (pack === undefined) throw new CreditsError({ code: CreditsErrorCode.PackNotFound })
        const existing = await this.orders.findOpenCreditPack({
            workspaceId: params.workspaceId,
            target: String(pack.creditsPerMonth),
            amountVnd: pack.priceVnd,
        })
        if (existing !== null) return this.billing.payable(existing)
        const order = await this.orders.create({
            workspaceId: params.workspaceId,
            userId,
            planCode: plan.code,
            amountVnd: pack.priceVnd,
            kind: "credit_pack",
            packCode: null,
            detail: { credits: pack.creditsPerMonth },
        })
        return this.billing.payable(order)
    }

    /** A pending top-up order for one pack (owner or manager); the same open order when it was just asked for. */
    async topup(userId: string, params: TopupParams): Promise<PayableOrder> {
        await this.billing.requireManager(userId, params.workspaceId)
        const pack = await this.requirePack(params.packCode)
        const plan = await this.requireActivePlan(params.workspaceId, ["active", "past_due"])
        if (plan.listed) throw new CreditsError({ code: CreditsErrorCode.UsePacks })
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
        if (target === null || !target.listed || target.perSeat || current.isCustom || target.isCustom)
            throw new CreditsError({ code: CreditsErrorCode.NotUpgrade })
        const workspace = await this.billing.findWorkspaceBilling(params.workspaceId)
        const currentPrice = workspace?.billedMonthlyVnd ?? current.priceVnd
        if (target.sort <= current.sort || target.priceVnd <= currentPrice) {
            throw new CreditsError({ code: CreditsErrorCode.NotUpgrade })
        }
        const now = this.clock.now()
        if (workspace?.paidUntil == null || new Date(workspace.paidUntil).getTime() <= now.getTime()) {
            throw new CreditsError({ code: CreditsErrorCode.RenewFirst })
        }
        const quote = prorateUpgrade({
            currentPrice,
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
                fromPrice: currentPrice,
                toPrice: target.priceVnd,
                credit: quote.credit,
                daysLeft: quote.daysLeft,
                paidUntil: workspace.paidUntil,
            },
        })
        return { payable: this.billing.payable(order), quote: upgradeQuote }
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
        if (workspace?.planCode == null || !statuses.includes(workspace.status)) {
            throw new CreditsError({ code: CreditsErrorCode.WorkspaceNotActive })
        }
        const plan = await this.billing.findPlan(workspace.planCode)
        if (plan === null) throw new CreditsError({ code: CreditsErrorCode.PlanNotFound })
        return plan
    }
}
