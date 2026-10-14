"use client"

import { useEffect, useRef } from "react"
import { useNow, useTranslations } from "next-intl"
import { useQueryPaymentOrderSwr } from "@/hooks/swr"
import { toast } from "@/modules/toast"
import type { PayOrder } from "@/modules/types"

/** Polls settlement through SWR and refreshes balances after one paid notification. */
export const useCreditsPaymentState = (workspaceId: string, order: PayOrder | null, onPaid: () => void) => {
    const t = useTranslations("credits")
    const now = useNow({ updateInterval: 1000 })
    const notified = useRef<string | undefined>(undefined)
    const payment = useQueryPaymentOrderSwr(workspaceId, order?.id)
    const left = order ? new Date(order.expiresAt).getTime() - now.getTime() : null
    const status = payment.data?.status
    let phase: "paid" | "expired" | "pending" = "pending"
    if (status === "paid") phase = "paid"
    else if (status === "expired" || status === "cancelled" || (left !== null && left <= 0)) phase = "expired"

    useEffect(() => {
        if (!order || phase !== "paid" || notified.current === order.id) return
        notified.current = order.id
        toast.success(t("paidTitle"))
        onPaid()
    }, [order, phase, onPaid, t])

    return { phase, left }
}
