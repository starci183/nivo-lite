"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCreditPackPurchase } from "@/hooks/billing"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { BillingCreditPacksBase } from "./component"

interface BillingCreditPacksProps {
    readonly workspaceId: string
}

/** The separate "Buy more credits" section: optional packs added to this month's credits, priced as packs and never per credit. */
export const BillingCreditPacks = (props: BillingCreditPacksProps) => {
    const t = useTranslations("billing")
    const format = useFormatter()
    const purchase = useCreditPackPurchase(props.workspaceId)
    const slotLabels = useSlotLabels()
    const money = (amount: number) =>
        format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    return (
        <BillingCreditPacksBase
            props={{
                title: t("packsTitle"),
                fact: t("packsFact"),
                buy: t("packsBuy"),
                empty: t("packsEmpty"),
                canBuy: purchase.canBuy,
                slot: mapSlot(purchase.packs, (packs) =>
                    packs.map((pack) => ({
                        id: String(pack.creditsPerMonth),
                        title: t("packsRow", { credits: format.number(pack.creditsPerMonth) }),
                        description: money(pack.priceVnd),
                        pending: purchase.isRequesting,
                        disabled: purchase.isRequesting,
                        target: { kind: "credit_pack" as const, credits: pack.creditsPerMonth },
                    })),
                ),
                labels: slotLabels(t("packsEmpty")),
            }}
            on={{
                retry: purchase.retry,
                buy: (target) => {
                    if (target.kind === "credit_pack") purchase.buy(target.credits)
                },
            }}
        />
    )
}
