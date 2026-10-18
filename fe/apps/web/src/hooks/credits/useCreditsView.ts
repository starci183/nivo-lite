"use client"

import { workspaceBillingPath } from "@/modules/routes"
import type { CreditsData, CreditsOverviewView, PlanView } from "@/modules/types"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { creditsSummaryOf } from "./credits.shared"

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
    const planPrice = (plan: PlanView) => {
        if (plan.isCustom) return t("planPriceContract")
        return t(plan.perSeat ? "planPriceSeat" : "planPriceMonth", { price: money(plan.price) })
    }
    const labels = {
        balance: t("balanceLabel"),
        topups: data && data.addOns.length > 0 ? t("addOnTitle") : t("topupTitle"),
        topupFact: data && data.addOns.length > 0 ? t("addOnFact") : t("topupFact"),
        ...labelsOf(t),
        plansHref: data ? workspaceBillingPath(data.workspaceId) : "",
        loading: t("loading"),
        emptyPacks: t("packsEmpty"),
    }
    const slotLabels = {
        ...slotLabelsOf(t),
    }
    const { figure, badge, badgeTone, topupText, forecast, carried, upgrade, contact } = creditsSummaryOf({
        data,
        busy,
        t,
        credit,
        money,
        day,
        name,
        allowance,
    })
    const view: CreditsOverviewView = viewOf({
        data,
        t,
        figure,
        badge,
        badgeTone,
        credit,
        topupText,
        forecast,
        carried,
        money,
        busy,
        upgrade,
        contact,
        name,
        planPrice,
        allowance,
    })
    return { view, labels, slotLabels }
}

/** Resolves the action labels for the current locale. */
const labelsOf = (t: ReturnType<typeof useTranslations<"credits">>) => ({
    upgrade: t("upgradeTitle"),
    plans: t("allPlans"),
    plansLabel: t("allPlansLabel"),
    buy: t("buy"),
    plansCta: t("plansCta"),
})

/** Resolves the data-slot labels for the current locale. */
const slotLabelsOf = (t: ReturnType<typeof useTranslations<"credits">>) => ({
    empty: t("errorText"),
    error: t("errorText"),
    forbidden: t("errForbidden"),
    retry: t("retry"),
})
/** The resolved inputs for credits view input. */
interface CreditsViewInput {
    readonly data: CreditsData | null
    readonly t: ReturnType<typeof useTranslations<"credits">>
    readonly figure: string
    readonly badge: string
    readonly badgeTone: "danger" | "warning"
    readonly credit: (value: number) => string
    readonly topupText: string
    readonly forecast: string
    readonly carried: string
    readonly money: (value: number) => string
    readonly busy: string | null
    readonly upgrade: CreditsOverviewView["upgrade"]
    readonly contact: CreditsOverviewView["contact"]
    readonly name: (plan: PlanView) => string
    readonly planPrice: (plan: PlanView) => string
    readonly allowance: (plan: PlanView) => string
}

const viewOf = ({
    data,
    t,
    figure,
    badge,
    badgeTone,
    credit,
    topupText,
    forecast,
    carried,
    money,
    busy,
    upgrade,
    contact,
    name,
    planPrice,
    allowance,
}: CreditsViewInput): CreditsOverviewView => {
    return {
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
                ...(data && data.addOns.length > 0
                    ? [{ id: "packs", term: t("termPacks"), value: t("creditUnit", { n: credit(data.packsBought) }) }]
                    : [{ id: "topup", term: t("termTopup"), value: topupText }]),
                { id: "forecast", term: t("termForecast"), value: forecast },
                { id: "carried", term: t("termCarried"), value: carried },
            ],
        },
        packs:
            data && data.addOns.length > 0
                ? data.addOns.map((pack) => ({
                      id: `pack-${pack.credits}`,
                      title: t("packTitle", { credits: credit(pack.credits) }),
                      description: t("packLine", { price: money(pack.price) }),
                      pending: busy === `pack-${pack.credits}`,
                      disabled: busy !== null && busy !== `pack-${pack.credits}`,
                      target: { kind: "credit_pack" as const, credits: pack.credits },
                  }))
                : (data?.packs.map((pack) => ({
                      id: pack.code,
                      title: t("packTitle", { credits: credit(pack.credits) }),
                      description: t("packLine", { price: money(pack.price) }),
                      pending: busy === pack.code,
                      disabled: busy !== null && busy !== pack.code,
                      target: { kind: "topup" as const, packCode: pack.code, credits: pack.credits },
                  })) ?? []),
        upgrade,
        contact,
        plans:
            data?.plans.map((plan) => ({
                id: plan.code,
                title: name(plan),
                description: plan.isCustom
                    ? t("planRowContract")
                    : t("planRow", {
                          price: planPrice(plan),
                          credits: allowance(plan),
                          who: t(plan.perSeat ? "whoTeam" : "whoOne"),
                      }),
                badge: plan.code === data.plan?.code ? t("currentPlan") : "",
            })) ?? [],
    }
}
