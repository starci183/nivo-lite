import type { useTranslations } from "next-intl"
import type { usePlanChoices } from "@/hooks/billing"
import type { PlanCardView } from "@/components/composites/PlanCatalog"
import { PlanCatalog } from "@/components/composites/PlanCatalog"
import type { PlanGroupView } from "@/components/composites/PlanCatalog"

/** Settled copy, prices and interactions of the plan catalogue. */
export interface BillingPlansBaseProps {
    readonly props: {
        readonly title: string
        readonly text: string
        readonly cycleLabel: string
        readonly cycle: string
        readonly cycleOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly notice?: string
        readonly storage?: string
        readonly groups: ReadonlyArray<PlanGroupView>
    }
    readonly on: {
        readonly setCycle: (value: string) => void
        readonly setTier: (planId: string, value: string) => void
        readonly setSeats: (value: number) => void
        readonly choose: (planId: string) => void
    }
}

/** Draws the plan catalogue from settled values. */
export const BillingPlansBase = (props: BillingPlansBaseProps) => <PlanCatalog props={props.props} on={props.on} />

/** One available plan from the billing read. */
type Plan = NonNullable<ReturnType<typeof usePlanChoices>["plans"]>[number]

/** The copy, formatting and purchase state used by each plan card. */
interface PlanCardContext {
    readonly t: ReturnType<typeof useTranslations<"billing">>
    readonly locale: string
    readonly choices: ReturnType<typeof usePlanChoices>
    readonly money: (amount: number) => string
    readonly count: (value: number) => string
    readonly buyable: ReadonlyArray<Plan>
    readonly canBuy: boolean
    readonly contactHref: string
}

/** Builds the quoted price, facts and checkout controls of a plan. */
export const planCardOf = (plan: Plan, context: PlanCardContext): PlanCardView => {
    const { t, locale, choices, money, count, buyable, canBuy } = context

    const name = locale === "vi" ? plan.nameVi : plan.nameEn
    const features = locale === "vi" ? plan.features.vi : plan.features.en
    const isCurrent = choices.workspace?.planCode === plan.code
    if (plan.isCustom) return customPlanCard(plan, context)
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
            if (plan.annualDiscountPct)
                badges.push({ label: t("saveBadge", { pct: plan.annualDiscountPct }), tone: "success" })
        } else {
            price = t("priceMonth", { price: money(quote.amountVnd) })
            if (quote.promo && plan.promoMonths) {
                const pct = Math.round((1 - quote.amountVnd / quote.listMonthlyVnd) * 100)
                badges.push({ label: t("promoBadge", { pct, months: plan.promoMonths }), tone: "accent" })
                notes.push(t("promoThen", { price: money(quote.listMonthlyVnd) }))
            }
        }
    }
    const tierOptions = plan.tiers.map((tier) => ({
        id: String(tier.creditsPerMonth),
        label: t("tierOption", { credits: count(tier.creditsPerMonth) }),
    }))
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
                      value: String(chosenTier ?? plan.tiers[0]?.creditsPerMonth ?? ""),
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

/** Builds the contact action for a custom plan. */
const customPlanCard = (plan: Plan, context: PlanCardContext): PlanCardView => {
    const { t, locale, choices } = context
    const name = locale === "vi" ? plan.nameVi : plan.nameEn
    const features = locale === "vi" ? plan.features.vi : plan.features.en
    const isCurrent = choices.workspace?.planCode === plan.code
    return {
        id: plan.code,
        name,
        isCurrent,
        price: t("priceContract"),
        isPriceLoading: false,
        badges: [],
        notes: [],
        facts: features,
        action: {
            kind: "contact",
            label: t("contactSales"),
            href: context.contactHref,
            isPending: false,
            isDisabled: false,
        },
    }
}
