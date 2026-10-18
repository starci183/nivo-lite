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
              .sort((left, right) => left.localeCompare(right))[0] ?? null)
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

/** Formatting and account context shared by the credit summaries. */
type CreditsSummaryInput = {
    readonly data: CreditsData | null
    readonly busy: string | null
    readonly t: ReturnType<typeof useTranslations<"credits">>
    readonly credit: (value: number) => string
    readonly money: (value: number) => string
    readonly day: (value: string) => string
    readonly name: (plan: PlanView) => string
    readonly allowance: (plan: PlanView) => string
}

/** Selects the balance wording without mixing unlimited and metered plans. */
const balanceFigureOf = ({ data, t, credit, name }: CreditsSummaryInput): string => {
    if (!data) return t("loading")
    const plan = data.plan ? name(data.plan) : ""
    if (data.limit === null)
        return t(data.plan ? "balanceUnlimited" : "balanceNoPlan", { used: credit(data.used), plan })
    if (data.plan) return t("balanceFigure", { used: credit(data.used), limit: credit(data.limit), plan })
    return t("balanceWithoutPlan", { used: credit(data.used), limit: credit(data.limit) })
}

/** Marks exhaustion or the remaining fraction of a finite allowance. */
const balanceBadgeOf = ({ data, t }: CreditsSummaryInput): { badge: string; badgeTone: "danger" | "warning" } => {
    if (data?.limit == null) return { badge: "", badgeTone: "warning" }
    if (data.used >= data.limit)
        return { badge: t(data.topup > 0 ? "exhaustedTopup" : "exhausted"), badgeTone: "danger" }
    const left = data.limit > 0 ? Math.floor(((data.limit - data.used) / data.limit) * 100) : 100
    return { badge: left < 20 ? t("leftPct", { pct: Math.max(0, left) }) : "", badgeTone: "warning" }
}

/** Presents the offered upgrade with the current purchase lock. */
const upgradeSummaryOf = ({
    data,
    busy,
    t,
    name,
    allowance,
    money,
}: CreditsSummaryInput): CreditsOverviewView["upgrade"] => {
    if (!data?.next) return null
    const next = data.next.plan
    return {
        name: name(next),
        line: t("planLine", { credits: allowance(next), storage: next.storageGb ?? 0 }),
        price: t("priceLine", { price: money(next.price) }),
        action: t("upgradeCta", { plan: name(next) }),
        pending: busy === next.code,
        disabled: busy !== null && busy !== next.code,
        target: { kind: "upgrade", planCode: next.code, planName: name(next), price: next.price },
    }
}

/** Resolves balance, exhaustion, expiry and upgrade summaries for the current account. */
export const creditsSummaryOf = (input: CreditsSummaryInput) => {
    const { data, t, credit, day, name } = input
    const loading = t("loading")
    let topupText = loading
    let forecast = loading
    let carried = loading
    let contact: CreditsOverviewView["contact"] = null
    if (data) {
        topupText =
            data.topup > 0 && data.topupExpires
                ? t("topupExpires", { n: credit(data.topup), date: day(data.topupExpires) })
                : t("topupValue", { n: credit(data.topup) })
        forecast = data.runout ? day(data.runout + "T00:00:00Z") : t("none")
        carried = data.carried > 0 ? t("creditUnit", { n: credit(data.carried) }) : t("none")
        if (data.contact)
            contact = {
                name: data.contact.plan ? name(data.contact.plan) : t("contactTitle"),
                text: t("contactText"),
                action: t("contactCta"),
                href: data.contact.href,
            }
    }
    return {
        figure: balanceFigureOf(input),
        ...balanceBadgeOf(input),
        topupText,
        forecast,
        carried,
        upgrade: upgradeSummaryOf(input),
        contact,
    }
}
