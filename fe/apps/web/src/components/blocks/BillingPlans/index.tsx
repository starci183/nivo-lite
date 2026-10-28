"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import type { PlanCardView, PlanGroupView } from "@/modules/types"
import { usePlanChoices } from "@/hooks/billing"
import { planCatalogCardOf } from "@/hooks/billingPlans"
import { BillingPlansBase } from "./component"

interface BillingPlansProps {
    readonly workspaceId: string
    readonly contactHref: string
}

const BYTES_PER_GB = 1024 ** 3

/** Connects the plan catalogue: prices come from the back end quote of each selection, never from a calculation here. */
/** Connects the state and commands used by BillingPlans. */
const buildBillingPlansState = (
    choices: ReturnType<typeof usePlanChoices>,
    format: ReturnType<typeof useFormatter>,
    t: ReturnType<typeof useTranslations<"billing">>,
    locale: ReturnType<typeof useLocale>,
    props: BillingPlansProps,
) => {
    const role = choices.workspace?.role
    const canBuy = role === "owner" || role === "manager"
    const money = (amount: number) =>
        format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const count = (value: number) => format.number(Math.round(value))
    const gigabytes = (bytes: number) =>
        format.number(bytes / BYTES_PER_GB, { style: "unit", unit: "gigabyte", maximumFractionDigits: 1 })
    const plans = choices.plans ?? []
    type Plan = (typeof plans)[number]
    const buyable = plans.filter((plan) => !plan.isCustom)
    const annualPct = Math.max(0, ...plans.map((plan) => plan.annualDiscountPct ?? 0))
    const cardOf = (plan: Plan): PlanCardView =>
        planCatalogCardOf(plan, { t, locale, choices, money, count, buyable, canBuy, contactHref: props.contactHref })
    const groups: PlanGroupView[] = [
        {
            id: "individual",
            title: t("groupIndividual"),
            text: t("groupIndividualText"),
            cards: plans.filter((plan) => plan.individual).map(cardOf),
        },
        {
            id: "team",
            title: t("groupTeam"),
            text: t("groupTeamText"),
            cards: plans.filter((plan) => plan.perSeat && !plan.individual && !plan.isCustom).map(cardOf),
        },
        {
            id: "enterprise",
            title: t("groupEnterprise"),
            text: t("groupEnterpriseText"),
            cards: plans.filter((plan) => plan.isCustom).map(cardOf),
        },
    ].filter((group) => group.cards.length > 0)
    const storage = choices.storage
    let storageNote: string | undefined
    if (storage) {
        storageNote = storage.quotaBytes
            ? t("storageUsed", { used: gigabytes(storage.usedBytes), quota: gigabytes(storage.quotaBytes) })
            : t("storageUsedOnly", { used: gigabytes(storage.usedBytes) })
    }
    if (plans.length === 0) return null
    return { t, choices, annualPct, canBuy, role, storageNote, groups }
}

/** Draws the connected view from its current state. */
export const BillingPlans = (props: BillingPlansProps) => {
    const t = useTranslations("billing")
    const locale = useLocale()
    const format = useFormatter()
    const choices = usePlanChoices(props.workspaceId)

    const connected = buildBillingPlansState(choices, format, t, locale, props)
    if (connected === null) return null
    const { annualPct, canBuy, role, storageNote, groups } = connected
    return (
        <BillingPlansBase
            props={{
                title: t("plansTitle"),
                text: t("plansText"),
                cycleLabel: t("cycleLabel"),
                cycle: choices.cycle,
                cycleOptions: [
                    { value: "monthly", label: t("cycleMonthly") },
                    { value: "annual", label: t("cycleAnnual", { pct: annualPct }) },
                ],
                notice: canBuy || !role ? undefined : t("needsRole"),
                storage: storageNote ? `${t("storageTitle")}: ${storageNote}` : undefined,
                groups,
            }}
            on={{
                setCycle: (value) => choices.setCycle(value === "annual" ? "annual" : "monthly"),
                setTier: (planId, value) => choices.setTier(planId, Number(value)),
                setSeats: choices.setSeats,
                choose: choices.choose,
            }}
        />
    )
}
