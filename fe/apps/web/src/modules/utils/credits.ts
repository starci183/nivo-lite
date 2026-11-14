import { dayjs } from "@/modules/dayjs"
import type { CreditsData, CreditsOverviewView, PayTarget, PlanView } from "@/modules/types"
import type { useTranslations } from "next-intl"

/** Client-safe estimates of the credits page; the back end determines every charge. */

/** Millionths of a credit: credits are fractions with 6 decimals, compared as integers so float drift never decides a rounding. */
const MICRO = 1_000_000
const microOf = (credits: number): number => (Number.isFinite(credits) ? Math.round(credits * MICRO) : 0)

/** Credits USED as shown: the exact figure rounded half up to a whole number. */
export const creditsUsedShown = (exact: number): number => Math.floor((microOf(exact) + MICRO / 2) / MICRO)

/** Credits LEFT as shown: the exact remainder floored (never more than is left), nothing left is 0. */
export const creditsLeftShown = (exact: number): number => Math.max(0, Math.floor(microOf(exact) / MICRO))

/** A call's, node's or run's credits: a figure under half a credit is the text "<1", exactly nothing is 0, else the whole number. */
export const creditsFigureShown = (exact: number): number | "<1" => {
    const micro = microOf(exact)
    return micro > 0 && micro < MICRO / 2 ? "<1" : creditsUsedShown(exact)
}

interface RunoutInput {
    readonly remaining: number
    readonly last7Credits: number
    readonly today: string
}

const addDays = (day: string, n: number): string => dayjs.utc(`${day}T00:00:00Z`).add(n, "day").format("YYYY-MM-DD")

/**
 * The date (YYYY-MM-DD, Vietnam calendar) this month's allowance runs out at the average daily burn of the last 7 days, or null
 * when it does not run out this month (no recent use, already used up, or the date falls in a later month).
 */
export const forecastRunout = (a: RunoutInput): string | null => {
    const avg = a.last7Credits / 7
    if (Number.isNaN(a.remaining) || Number.isNaN(avg) || a.remaining <= 0 || avg <= 0) return null
    const date = addDays(a.today, Math.floor(a.remaining / avg))
    return date.slice(0, 7) === a.today.slice(0, 7) ? date : null
}

/** Formatting and account context shared by the credit summaries. */
export type CreditsSummaryInput = {
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

/** What `creditsSummaryOf` returns. */
export interface CreditsSummaryOfResult {
    topupText: string
    forecast: string
    carried: string
    upgrade: {
        readonly name: string
        readonly line: string
        readonly price: string
        readonly action: string
        readonly pending: boolean
        readonly disabled: boolean
        readonly target: PayTarget
    } | null
    contact: {
        readonly name: string
        readonly text: string
        readonly action: string
        readonly href: string
    } | null
    badge: string
    badgeTone: "danger" | "warning"
    figure: string
}

/** Resolves balance, exhaustion, expiry and upgrade summaries for the current account. */
export const creditsSummaryOf = (input: CreditsSummaryInput): CreditsSummaryOfResult => {
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
