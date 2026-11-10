"use client"

import { useState } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { usePlanChoices } from "@/hooks/billing"
import { useWorkspaceId } from "@/hooks/workspaces"
import { workspaceHandoverPath, workspaceReadyPath } from "@/modules/routes"
import { OnboardingPlanBase } from "./component"
import type { PlanOfferCard } from "@/components/composites/PlanCards"

/** What the plan step reads from the connected block. */
type OnboardingPlanProps = {
    /** Where the Enterprise plan sends the owner to talk to NIVO. */
    readonly contactHref: string
}

/** The connected plan step: the listed plans of the catalogue side by side (the middle paid plan recommended), the contract plan as a contact, and the free plan the workspace already runs on. */
export const OnboardingPlan = (props: OnboardingPlanProps) => {
    const t = useTranslations("onboarding")
    const format = useFormatter()
    const locale = useLocale()
    const workspaceId = useWorkspaceId()
    const choices = usePlanChoices(workspaceId)
    const [chosen, setChosen] = useState<string | null>(null)
    const listed = [...(choices.plans ?? [])].filter((plan) => plan.listed).sort((a, b) => a.sort - b.sort)
    const paid = listed.filter((plan) => !plan.isCustom)
    const popularCode = paid[Math.floor(paid.length / 2)]?.code
    const money = (amount: number) =>
        format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const priceOf = (plan: (typeof listed)[number]): string => {
        if (plan.isCustom) return t("planContactPrice")
        if (choices.cycle === "annual" && plan.priceAnnualVnd !== null)
            return t("planPerYear", { price: money(plan.priceAnnualVnd) })
        return t("planPerMonth", { price: money(plan.promoPriceVnd ?? plan.priceVnd) })
    }
    const plans: ReadonlyArray<PlanOfferCard> = listed.map((plan) => {
        const name = locale === "vi" ? plan.nameVi : plan.nameEn
        const extra = locale === "vi" ? plan.features.vi : plan.features.en
        const facts = plan.isCustom
            ? []
            : [
                  t("planSeats", { seats: plan.seats }),
                  ...(plan.aiCreditsPerMonth === null
                      ? []
                      : [t("planCredits", { credits: format.number(plan.aiCreditsPerMonth) })]),
              ]
        return {
            id: plan.code,
            name,
            price: priceOf(plan),
            mark: plan.code === popularCode ? t("planPopular") : undefined,
            features: [...facts, ...extra],
            action: plan.isCustom
                ? { kind: "contact", label: t("planContact"), href: props.contactHref }
                : { kind: "buy", label: t("planChoose", { plan: name }), isPrimary: plan.code === popularCode },
        }
    })
    return (
        <OnboardingPlanBase
            props={{
                heading: t("planQuestion"),
                description: t("planText"),
                cycleLabel: t("planCycle"),
                cycle: choices.cycle,
                cycleMonthly: t("planMonthly"),
                cycleAnnual: t("planAnnual"),
                plans,
                isLoading: choices.isLoading,
                pendingId: choices.isRequesting ? chosen : null,
                free: {
                    title: t("planFreeTitle"),
                    text: t("planFreeText"),
                    label: t("planStartFree"),
                    href: workspaceReadyPath(workspaceId),
                },
                backLabel: t("back"),
                backHref: workspaceHandoverPath(workspaceId),
                note: t("planNote"),
            }}
            on={{
                setCycle: (cycle) => choices.setCycle(cycle === "annual" ? "annual" : "monthly"),
                buy: (planId) => {
                    setChosen(planId)
                    choices.choose(planId)
                },
            }}
        />
    )
}
