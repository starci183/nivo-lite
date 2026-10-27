"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCreditsPayDrawer, useCreditsPaymentState } from "@/hooks/credits"
import { PayDrawerBase } from "./component"
import type { PayDrawerShape } from "./component"

const clock = (ms: number) => {
    const seconds = Math.max(0, Math.floor(ms / 1000))
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

/** Connects the transfer drawer to payment settlement, localized amounts, and countdown copy. */
export const PayDrawer = () => {
    const drawer = useCreditsPayDrawer()
    const t = useTranslations("credits")
    const formatter = useFormatter()
    const money = (amount: number) =>
        formatter.number(amount, {
            style: "currency",
            currency: "VND",
            maximumFractionDigits: 0,
        })
    const { phase, left } = useCreditsPaymentState(drawer.workspaceId, drawer.order, drawer.onPaid)
    const { title, paidDescription } = paymentCopy(drawer, formatter, t)
    let shape: PayDrawerShape = "awaiting"
    const isWaiting = phase !== "paid" && !drawer.order && drawer.isRegenerating
    if (phase === "paid") shape = "paid"
    else if (phase === "expired" || !drawer.order) shape = "expired"

    let proration: string | null = null
    if (
        drawer.order?.credit !== undefined &&
        drawer.order.daysLeft !== undefined &&
        drawer.target?.kind === "upgrade"
    ) {
        proration = t("prorationNote", {
            plan: drawer.target.planName,
            price: money(drawer.target.price),
            credit: money(drawer.order.credit),
            days: drawer.order.daysLeft,
        })
    }

    if (drawer.target === null) return null

    return (
        <PayDrawerBase
            shape={shape}
            props={{
                isWaiting,
                isRegenerating: drawer.isRegenerating,
                isBankConfigured: Boolean(drawer.bank.account && drawer.bank.bank),
                hasOrder: drawer.order !== null,
                title,
                description: t("payText"),
                closeLabel: t("close"),
                paidTitle: t("paidTitle"),
                paidDescription,
                waitingLabel: t("waiting"),
                expiredTitle: t("expiredTitle"),
                expiredDescription: t("expiredText"),
                errorTitle: t("errGeneric"),
                regenerateError: drawer.regenerateError,
                regenerateLabel: t("regenerate"),
                scanLabel: t("scan"),
                qrAlt: t("qrAlt"),
                unconfiguredLabel: t("notConfigured"),
                countdown: left === null ? null : t("expiresIn", { time: clock(left) }),
                amountLabel: t("amount"),
                amount: drawer.order ? money(drawer.order.amount) : "",
                qrUrl: drawer.order?.qrUrl ?? "",
                proration,
                copyLabel: t("copy"),
                copiedLabel: t("copied"),
                details: [
                    { id: "credits-pay-bank", label: t("bank"), value: drawer.bank.bank },
                    { id: "credits-pay-account", label: t("account"), value: drawer.bank.account },
                    { id: "credits-pay-holder", label: t("holder"), value: drawer.bank.holder },
                    { id: "credits-pay-content", label: t("content"), value: drawer.order?.code ?? "" },
                ],
                contentWarning: t("contentWarn"),
            }}
            on={{ close: drawer.onClose, regenerate: drawer.onRegenerate }}
        />
    )
}

/** Resolves the target-specific payment and settlement descriptions. */
const paymentCopy = (
    drawer: ReturnType<typeof useCreditsPayDrawer>,
    formatter: ReturnType<typeof useFormatter>,
    t: ReturnType<typeof useTranslations<"credits">>,
) => {
    const credits =
        drawer.target?.kind === "topup" || drawer.target?.kind === "credit_pack"
            ? formatter.number(drawer.target.credits)
            : ""
    const isPack = drawer.target?.kind === "credit_pack"
    let title = t(isPack ? "payPack" : "payTopup", { credits })
    let paidDescription = t(isPack ? "paidPack" : "paidTopup", { credits })
    if (drawer.target?.kind === "upgrade") {
        title = t("payUpgrade", { plan: drawer.target.planName })
        paidDescription = t("paidUpgrade", { plan: drawer.target.planName })
    }
    return { title, paidDescription }
}
