import { useFormatter, useLocale, useTranslations } from "next-intl"
import { workspaceBillingPath } from "@/modules/routes"
import type { CreditsData, CreditsOverviewView, PlanView } from "@/modules/types"

/** Resolves every locale-sensitive label before the pure credits drawing. */
export const useCreditsView = (data: CreditsData | null, busy: string | null) => {
    const t = useTranslations("credits")
    const locale = useLocale()
    const formatter = useFormatter()
    const credit = (value: number) => formatter.number(Math.round(value))
    const money = (value: number) =>
        formatter.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const day = (value: string) => formatter.dateTime(new Date(value), { dateStyle: "medium" })
    const name = (plan: PlanView) => (locale === "vi" ? plan.nameVi : plan.nameEn)
    const allowance = (plan: PlanView) => (plan.credits === null ? "∞" : credit(plan.credits))
    const planPrice = (plan: PlanView) =>
        plan.isCustom
            ? t("planPriceContract")
            : t(plan.perSeat ? "planPriceSeat" : "planPriceMonth", { price: money(plan.price) })
    const labels = {
        balance: t("balanceLabel"),
        topups: t("topupTitle"),
        topupFact: t("topupFact"),
        upgrade: t("upgradeTitle"),
        plans: t("allPlans"),
        plansLabel: t("allPlansLabel"),
        buy: t("buy"),
        plansCta: t("plansCta"),
        plansHref: data ? workspaceBillingPath(data.workspaceId) : "",
        loading: t("loading"),
        emptyPacks: t("packsEmpty"),
    }
    const slotLabels = {
        empty: t("errorText"),
        error: t("errorText"),
        forbidden: t("errForbidden"),
        retry: t("retry"),
    }
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
    const view: CreditsOverviewView = {
        canBuy: data?.canBuy ?? false,
        staffNote: t("staffNote"),
        balance: {
            figure,
            badge,
            badgeTone,
            used: data?.used ?? 0,
            limit: data?.limit ?? null,
            meterLabel: t("meterLabel"),
            meterValue: t("meterValue", { used: credit(data?.used ?? 0), limit: credit(data?.limit ?? 0) }),
            details: [
                { id: "topup", term: t("termTopup"), value: topupText },
                { id: "forecast", term: t("termForecast"), value: forecast },
                { id: "carried", term: t("termCarried"), value: carried },
            ],
        },
        packs:
            data?.packs.map((pack) => ({
                id: pack.code,
                title: t("packTitle", { credits: credit(pack.credits) }),
                description: t("packLine", { price: money(pack.price) }),
                pending: busy === pack.code,
                disabled: busy !== null && busy !== pack.code,
                target: { kind: "topup" as const, packCode: pack.code, credits: pack.credits },
            })) ?? [],
        upgrade,
        contact,
        plans:
            data?.plans.map((plan) => ({
                id: plan.code,
                title: name(plan),
                description: plan.isCustom
                    ? t("planRowContract")
                    : t("planRow", { price: planPrice(plan), credits: allowance(plan), who: t(plan.perSeat ? "whoTeam" : "whoOne") }),
                badge: plan.code === data.plan?.code ? t("currentPlan") : "",
            })) ?? [],
    }
    return { view, labels, slotLabels }
}
