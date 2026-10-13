"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import type { PlanCardView, PlanGroupView } from "@/components/composites/PlanCatalog"
import { usePlanChoices } from "@/hooks/billing"
import { BillingPlansBase } from "./component"

interface BillingPlansProps {
    readonly workspaceId: string
    readonly contactHref: string
}

/** The id of the plan's own allowance in a usage-tier list. */
const BASE_TIER = "base"
const BYTES_PER_GB = 1024 ** 3

/** Connects the plan catalogue: prices come from the back end quote of each selection, never from a calculation here. */
export const BillingPlans = (props: BillingPlansProps) => {
    const t = useTranslations("billing")
    const locale = useLocale()
    const format = useFormatter()
    const choices = usePlanChoices(props.workspaceId)
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

    const cardOf = (plan: Plan): PlanCardView => {
        const name = locale === "vi" ? plan.nameVi : plan.nameEn
        const features = (locale === "vi" ? plan.features.vi : plan.features.en)
        const isCurrent = choices.workspace?.planCode === plan.code
        if (plan.isCustom) {
            return {
                id: plan.code,
                name,
                isCurrent,
                price: t("priceContract"),
                isPriceLoading: false,
                badges: [],
                notes: [],
                facts: features,
                action: { kind: "contact", label: t("contactSales"), href: props.contactHref, isPending: false, isDisabled: false },
            }
        }
        const index = buyable.findIndex((candidate) => candidate.code === plan.code)
        const quote = choices.quotes?.[index]
        const selection = choices.selections[index]
        const badges: PlanCardView["badges"][number][] = []
        const notes: string[] = []
        let price = ""
        if (quote) {
            if (plan.perSeat) {
                price = t("priceSeatMonth", { price: money(quote.listMonthlyVnd / quote.seats) })
                notes.push(t("seatsTotal", { seats: quote.seats, total: money(quote.amountVnd) }))
            } else if (quote.cycle === "annual") {
                price = t("priceYear", { price: money(quote.amountVnd) })
                notes.push(t("yearlyNote", { price: money(quote.listMonthlyVnd) }))
                if (plan.annualDiscountPct) badges.push({ label: t("saveBadge", { pct: plan.annualDiscountPct }), tone: "success" })
            } else {
                price = t("priceMonth", { price: money(quote.amountVnd) })
                if (quote.promo && plan.promoMonths) {
                    const pct = Math.round((1 - quote.amountVnd / quote.listMonthlyVnd) * 100)
                    badges.push({ label: t("promoBadge", { pct, months: plan.promoMonths }), tone: "accent" })
                    notes.push(t("promoThen", { price: money(quote.listMonthlyVnd) }))
                }
            }
        }
        const baseCredits = plan.aiCreditsPerMonth
        const tierOptions = plan.perSeat
            ? plan.tiers.map((tier) => ({ id: String(tier.creditsPerMonth), label: t("tierOption", { credits: count(tier.creditsPerMonth) }) }))
            : [
                  ...(baseCredits === null || baseCredits === undefined
                      ? []
                      : [{ id: BASE_TIER, label: t("tierOption", { credits: count(baseCredits) }) }]),
                  ...plan.tiers
                      .filter((tier) => tier.creditsPerMonth !== baseCredits)
                      .map((tier) => ({ id: String(tier.creditsPerMonth), label: t("tierOption", { credits: count(tier.creditsPerMonth) }) })),
              ]
        const chosenTier = selection?.tierCredits
        const facts: string[] = []
        if (!plan.perSeat && quote?.creditsPerMonth != null)
            facts.push(t("creditsLine", { n: count(quote.creditsPerMonth) }))
        facts.push(plan.storageGb ? t("storageLine", { n: plan.storageGb }) : t("storageUnlimited"))
        facts.push(...features)
        return {
            id: plan.code,
            name,
            isCurrent,
            price: price || t("priceMonth", { price: money(plan.priceVnd) }),
            isPriceLoading: !quote,
            badges: isCurrent ? [{ label: t("currentBadge"), tone: "neutral" }, ...badges] : badges,
            notes,
            facts,
            tier:
                tierOptions.length > 1
                    ? {
                          label: t("tierLabel"),
                          value: chosenTier === null || chosenTier === undefined ? BASE_TIER : String(chosenTier),
                          options: tierOptions,
                      }
                    : undefined,
            seats: plan.perSeat ? { label: t("seatsLabel"), value: choices.seats, max: plan.seats } : undefined,
            action: {
                kind: "checkout",
                href: "",
                label: isCurrent ? t("chosenCurrent", { plan: name }) : t("choose", { plan: name }),
                isPending: choices.isRequesting,
                isDisabled: !canBuy || choices.isRequesting || !quote,
            },
        }
    }

    const groups: PlanGroupView[] = [
        { id: "individual", title: t("groupIndividual"), text: t("groupIndividualText"), cards: plans.filter((plan) => plan.individual).map(cardOf) },
        { id: "team", title: t("groupTeam"), text: t("groupTeamText"), cards: plans.filter((plan) => plan.perSeat && !plan.individual && !plan.isCustom).map(cardOf) },
        { id: "enterprise", title: t("groupEnterprise"), text: t("groupEnterpriseText"), cards: plans.filter((plan) => plan.isCustom).map(cardOf) },
    ].filter((group) => group.cards.length > 0)

    const storage = choices.storage
    let storageNote: string | undefined
    if (storage) {
        storageNote = storage.quotaBytes
            ? t("storageUsed", { used: gigabytes(storage.usedBytes), quota: gigabytes(storage.quotaBytes) })
            : t("storageUsedOnly", { used: gigabytes(storage.usedBytes) })
    }
    if (plans.length === 0) return null
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
                setTier: (planId, value) => choices.setTier(planId, value === BASE_TIER ? null : Number(value)),
                setSeats: choices.setSeats,
                choose: choices.choose,
            }}
        />
    )
}
