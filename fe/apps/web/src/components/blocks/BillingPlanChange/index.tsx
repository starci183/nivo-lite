"use client"

import { useState } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { usePlanChoices } from "@/hooks/billing"
import type { PlanChoicesView } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import type { PlanOfferCard } from "@/components/composites/PlanCards"
import { BillingPlanChangeBase } from "./component"
import type { PlanChangeSummary } from "./component"

/** What the plan change reads from its page. */
interface BillingPlanChangeProps {
    /** Where the Enterprise plan sends the owner to talk to NIVO. */
    readonly contactHref: string
}

type Plan = NonNullable<PlanChoicesView["plans"]>[number]
type Translate = ReturnType<typeof useTranslations<"billing">>
type Money = (amount: number) => string

/** The formatters and words every card and the summary are drawn with. */
interface PlanWords {
    readonly t: Translate
    readonly money: Money
    readonly name: (plan: Plan) => string
    readonly count: (n: number) => string
}

/** The words of a card, with the cycle priced and the contact link. */
interface CardWords extends PlanWords {
    readonly cycle: string
    readonly contactHref: string
}

/** The price line of a plan for the chosen cycle. */
const priceOf = (plan: Plan, view: CardWords): string => {
    if (plan.isCustom) return view.t("contactPrice")
    if (view.cycle === "annual" && plan.priceAnnualVnd !== null) return view.t("perYear", { price: view.money(plan.priceAnnualVnd) })
    return view.t("perMonth", { price: view.money(plan.promoPriceVnd ?? plan.priceVnd) })
}

/** The listed plans in their order. */
const listedOf = (choices: PlanChoicesView): ReadonlyArray<Plan> =>
    [...(choices.plans ?? [])].filter((plan) => plan.listed).sort((a, b) => a.sort - b.sort)

/** One plan card: the plan in use is marked and has no command, the contract plan asks for contact, the others move up or down. */
const cardOf = (plan: Plan, current: Plan | undefined, view: CardWords): PlanOfferCard => {
    const { t, name } = view
    const isCurrent = plan.code === current?.code
    const price = priceOf(plan, view)
    const facts = plan.isCustom
        ? []
        : [t("seatsUpTo", { seats: plan.seats }), ...(plan.aiCreditsPerMonth === null ? [] : [t("creditsMonthly", { credits: view.count(plan.aiCreditsPerMonth) })])]
    const isUp = current === undefined || plan.sort > current.sort
    let action: PlanOfferCard["action"]
    if (isCurrent) action = { kind: "current", label: t("currentBadge") }
    else if (plan.isCustom) action = { kind: "contact", label: t("contactNivo"), href: view.contactHref }
    else action = { kind: "buy", label: t(isUp ? "upgradeTo" : "downgradeTo", { plan: name(plan) }), isPrimary: false }
    return { id: plan.code, name: name(plan), price, mark: isCurrent ? t("currentBadge") : undefined, features: facts, action }
}

/** What the picked plan costs today and from the next renewal, read from the back end quote of its selection. */
const summaryOf = (choices: PlanChoicesView, chosen: Plan, current: Plan | undefined, view: PlanWords): PlanChangeSummary | undefined => {
    const quote = (choices.quotes ?? []).find((candidate) => candidate?.planCode === chosen.code)
    if (quote === undefined || quote === null) return undefined
    const { t, money } = view
    return {
        title: current === undefined ? view.name(chosen) : t("changeFromTo", { from: view.name(current), to: view.name(chosen) }),
        facts: [
            { id: "today", term: t("payToday"), description: t("payTodayValue", { amount: money(quote.amountVnd), months: quote.months }) },
            { id: "next", term: t("fromNextRenewal"), description: t("perMonth", { price: money(quote.listMonthlyVnd) }) },
            {
                id: "gets",
                term: t("youGet"),
                description: [t("seatsUpTo", { seats: quote.seats || chosen.seats }), ...(quote.creditsPerMonth === null ? [] : [t("creditsMonthly", { credits: view.count(quote.creditsPerMonth) })])].join(" · "),
            },
        ],
        payLabel: t("payAmount", { amount: money(quote.amountVnd) }),
        isPaying: choices.isRequesting,
    }
}

/** The connected plan change: the listed plans with the one in use marked, and the priced change of the plan picked. */
export const BillingPlanChange = (props: BillingPlanChangeProps) => {
    const t = useTranslations("billing")
    const locale = useLocale()
    const format = useFormatter()
    const member = useMember()
    const choices = usePlanChoices(member?.workspaceId ?? "")
    const [chosenId, setChosenId] = useState<string | null>(null)
    const money: Money = (amount) => format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const count = (value: number) => format.number(Math.round(value))
    const name = (plan: Plan) => (locale === "vi" ? plan.nameVi : plan.nameEn)
    const listed = listedOf(choices)
    const current = listed.find((plan) => plan.code === choices.workspace?.planCode)
    const chosen = listed.find((plan) => plan.code === chosenId)
    const view = { t, money, name, count, cycle: choices.cycle, contactHref: props.contactHref }
    const annualPct = Math.max(0, ...listed.map((plan) => plan.annualDiscountPct ?? 0))
    return (
        <BillingPlanChangeBase
            props={{
                cycleLabel: t("cycleLabel"),
                cycle: choices.cycle,
                cycleMonthly: t("cycleMonthly"),
                cycleAnnual: t("cycleAnnual", { pct: annualPct }),
                plans: listed.map((plan) => cardOf(plan, current, view)),
                isLoading: choices.isLoading,
                chosenId,
                summaryLabel: t("changeSummary"),
                summary: chosen === undefined ? undefined : summaryOf(choices, chosen, current, view),
                cancelLabel: t("cancelChange"),
                note: t("changeNote"),
            }}
            on={{
                setCycle: (cycle) => choices.setCycle(cycle === "annual" ? "annual" : "monthly"),
                choose: setChosenId,
                pay: () => {
                    if (chosenId !== null) choices.choose(chosenId)
                },
                cancel: () => setChosenId(null),
            }}
        />
    )
}
