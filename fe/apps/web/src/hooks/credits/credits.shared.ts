import type {
    BillingPlanType,
    BillingWorkspaceType,
    CreditPackPurchaseType,
    CreditPackType,
    CreditQuotaStatusType,
    CreditTopupLotType,
} from "@/hooks/swr"
import { dayjs } from "@/modules/dayjs"
import type { CreditsOverviewView, CreditsData, PlanView } from "@/modules/types"
import { forecastRunout } from "@/modules/utils"
import type { useTranslations } from "next-intl"

/** Plain data of the credits page, and the pure functions that compute it from the rows the page read. */

/** A credit is 0.00113 USD of model token cost (billing_config.credit_usd_value in the database): the forecast converts dollars with it. */
const CREDIT_USD_VALUE = 0.00113

/** The workspace columns the page reads. */
type WorkspaceFacts = Pick<BillingWorkspaceType, "status" | "planCode" | "paidUntil">

/** Everything the credits page is computed from. */
interface CreditsInput {
    readonly workspaceId: string
    readonly canBuy: boolean
    readonly workspace: WorkspaceFacts
    readonly plans: ReadonlyArray<BillingPlanType>
    /** The plan the workspace is on, which may no longer be on sale. */
    readonly current: BillingPlanType | null
    readonly packs: ReadonlyArray<CreditPackType>
    readonly status: CreditQuotaStatusType | null
    readonly lots: ReadonlyArray<CreditTopupLotType>
    /** The add-on packs paid for this month. */
    readonly bought: ReadonlyArray<CreditPackPurchaseType>
    /** The model cost in USD of the last 7 days. */
    readonly last7CostUsd: number
    /** Today, YYYY-MM-DD (product calendar). */
    readonly today: string
    readonly now: Date
    /** Where "contact NIVO" goes. */
    readonly contactHref: string
}

const planViewOf = (plan: BillingPlanType): PlanView => ({
    code: plan.code,
    nameVi: plan.nameVi,
    nameEn: plan.nameEn,
    credits: plan.aiCreditsPerMonth ?? null,
    price: plan.priceVnd,
    seats: plan.seats,
    isCustom: plan.isCustom,
    individual: plan.individual,
    perSeat: plan.perSeat,
    storageGb: plan.storageGb ?? null,
})

const topupExpiryOf = (topup: number, lots: ReadonlyArray<CreditTopupLotType>, now: Date): string | null =>
    topup > 0
        ? (lots
              .filter((lot) => lot.creditsRemaining > 0 && dayjs(lot.expiresAt).valueOf() > now.getTime())
              .map((lot) => lot.expiresAt)
              .sort()[0] ?? null)
        : null

/** Computes every figure the credits page shows from the rows the page read. */
export const creditsDataOf = (input: CreditsInput): CreditsData => {
    const views = input.plans.map(planViewOf)
    const plan = input.current ? planViewOf(input.current) : null
    const upgradable = views.filter((view) => !view.isCustom && !view.perSeat)
    const next =
        plan && !plan.isCustom
            ? (upgradable
                  .filter((candidate) => candidate.price > plan.price && (candidate.credits ?? 0) > (plan.credits ?? 0))
                  .sort((left, right) => left.price - right.price)[0] ?? null)
            : null
    const topup = input.status?.topupBalance ?? 0
    const limit = input.status ? (input.status.creditsLimit ?? null) : (plan?.credits ?? null)
    const used = input.status?.creditsUsed ?? 0
    return {
        workspaceId: input.workspaceId,
        canBuy: input.canBuy,
        paidUntil: input.workspace.paidUntil ?? null,
        plan,
        used,
        limit,
        carried: input.status?.creditsCarried ?? 0,
        topup,
        topupExpires: topupExpiryOf(topup, input.lots, input.now),
        runout:
            limit === null
                ? null
                : forecastRunout({
                      remaining: limit - used,
                      last7Credits: Math.ceil(input.last7CostUsd / CREDIT_USD_VALUE),
                      today: input.today,
                  }),
        packs: input.packs.map((pack) => ({
            code: pack.code,
            credits: pack.credits,
            price: pack.priceVnd,
        })),
        plans: views,
        addOns: (input.current?.packs ?? []).map((pack) => ({ credits: pack.creditsPerMonth, price: pack.priceVnd })),
        packsBought: input.bought.reduce((total, purchase) => total + purchase.credits, 0),
        next: next ? { plan: next } : null,
        contact: next ? null : { plan: views.find((view) => view.isCustom) ?? null, href: input.contactHref },
        orders: [],
        bank: { account: "", bank: "", holder: "" },
    }
}

/** Resolves balance, exhaustion, expiry and upgrade summaries for the current account. */
export const creditsSummaryOf = (
    data: CreditsData | null,
    busy: string | null,
    t: ReturnType<typeof useTranslations<"credits">>,
    credit: (value: number) => string,
    money: (value: number) => string,
    day: (value: string) => string,
    name: (plan: PlanView) => string,
    allowance: (plan: PlanView) => string,
) => {
    let figure = t("loading")
    let badge = ""
    let badgeTone: "danger" | "warning" = "warning"
    let topupText = t("loading")
    let forecast = t("loading")
    let carried = t("loading")
    let upgrade: CreditsOverviewView["upgrade"] = null
    let contact: CreditsOverviewView["contact"] = null
    if (data) {
        const planLabel = data.plan ? name(data.plan) : ""
        if (data.limit === null)
            figure = t(data.plan ? "balanceUnlimited" : "balanceNoPlan", { used: credit(data.used), plan: planLabel })
        else if (data.plan)
            figure = t("balanceFigure", { used: credit(data.used), limit: credit(data.limit), plan: planLabel })
        else figure = t("balanceWithoutPlan", { used: credit(data.used), limit: credit(data.limit) })
        if (data.limit !== null && data.used >= data.limit) {
            badge = t(data.topup > 0 ? "exhaustedTopup" : "exhausted")
            badgeTone = "danger"
        } else if (data.limit !== null && data.limit > 0) {
            const left = Math.floor(((data.limit - data.used) / data.limit) * 100)
            if (left < 20) badge = t("leftPct", { pct: Math.max(0, left) })
        }
        topupText = t("topupValue", { n: credit(data.topup) })
        if (data.topup > 0 && data.topupExpires)
            topupText = t("topupExpires", { n: credit(data.topup), date: day(data.topupExpires) })
        forecast = data.runout ? day(data.runout + "T00:00:00Z") : t("none")
        carried = data.carried > 0 ? t("creditUnit", { n: credit(data.carried) }) : t("none")
        if (data.next) {
            const next = data.next.plan
            upgrade = {
                name: name(next),
                line: t("planLine", { credits: allowance(next), storage: next.storageGb ?? 0 }),
                price: t("priceLine", { price: money(next.price) }),
                action: t("upgradeCta", { plan: name(next) }),
                pending: busy === next.code,
                disabled: busy !== null && busy !== next.code,
                target: { kind: "upgrade", planCode: next.code, planName: name(next), price: next.price },
            }
        }
        if (data.contact)
            contact = {
                name: data.contact.plan ? name(data.contact.plan) : t("contactTitle"),
                text: t("contactText"),
                action: t("contactCta"),
                href: data.contact.href,
            }
    }
    return { figure, badge, badgeTone, topupText, forecast, carried, upgrade, contact }
}
