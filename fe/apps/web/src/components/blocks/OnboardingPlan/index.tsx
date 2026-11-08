"use client"

import { useState } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { usePlanChoices } from "@/hooks/billing"
import { useWorkspaceId } from "@/hooks/workspaces"
import { workspaceHandoverPath, workspaceReadyPath } from "@/modules/routes"
import { OnboardingPlanBase } from "./component"
import type { OnboardingPlanCommit, OnboardingPlanOption } from "./component"

/** The choice that keeps the workspace on the free plan it was made with. */
const FREE = "free"

/** What the plan step reads from the connected block. */
type OnboardingPlanProps = {
    /** Where the Enterprise plan sends the owner to talk to NIVO. */
    readonly contactHref: string
}

/** The connected plan step: the listed plans of the catalogue, the contract plan and the free plan; a paid plan opens its payment. */
export const OnboardingPlan = (props: OnboardingPlanProps) => {
    const t = useTranslations("onboarding")
    const format = useFormatter()
    const locale = useLocale()
    const workspaceId = useWorkspaceId()
    const choices = usePlanChoices(workspaceId)
    const listed = [...(choices.plans ?? [])].filter((plan) => plan.listed).sort((a, b) => a.sort - b.sort)
    const firstPaid = listed.find((plan) => !plan.isCustom)?.code
    const [picked, setPicked] = useState<string | null>(null)
    const selected = picked ?? firstPaid ?? FREE
    const money = (amount: number) =>
        format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const options: ReadonlyArray<OnboardingPlanOption> = [
        ...listed.map((plan) => ({
            value: plan.code,
            label: locale === "vi" ? plan.nameVi : plan.nameEn,
            description: plan.isCustom
                ? t("planContract")
                : t("planPaidLine", { price: money(plan.promoPriceVnd ?? plan.priceVnd), seats: plan.seats }),
        })),
        { value: FREE, label: t("planFree"), description: t("planFreeLine") },
    ]
    const chosen = listed.find((plan) => plan.code === selected)
    const commitOf = (): OnboardingPlanCommit => {
        if (chosen === undefined)
            return { kind: "href", label: t("planStartFree"), href: workspaceReadyPath(workspaceId) }
        if (chosen.isCustom) return { kind: "href", label: t("planContact"), href: props.contactHref }
        return { kind: "buy", label: t("planPay") }
    }
    return (
        <OnboardingPlanBase
            props={{
                title: t("planTitle"),
                heading: t("planQuestion"),
                description: t("planText"),
                choiceLabel: t("trackStep4"),
                options,
                selected,
                note: t("planNote"),
                isLoading: choices.isLoading,
                isPending: choices.isRequesting,
                backLabel: t("back"),
                backHref: workspaceHandoverPath(workspaceId),
                commit: commitOf(),
            }}
            on={{
                select: setPicked,
                buy: () => {
                    if (chosen !== undefined) choices.choose(chosen.code)
                },
            }}
        />
    )
}
