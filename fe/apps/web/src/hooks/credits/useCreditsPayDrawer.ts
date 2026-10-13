import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { mutate } from "swr"
import { useQueryPaymentOrderSwr } from "@/hooks/swr"
import { useCreditsCheckoutStore } from "@/hooks/zustand/creditsCheckout"
import type { PayOrder } from "@/modules/types"

/** Resolves the drawer slot from the chosen purchase and backend payment instructions. */
export const useCreditsPayDrawer = () => {
    const t = useTranslations("credits")
    const { target, workspaceId, orderId, isRequesting, error, close, requestHandler } = useCreditsCheckoutStore()
    const payment = useQueryPaymentOrderSwr(workspaceId, orderId)
    const value = payment.data
    const order: PayOrder | null = value
        ? {
              id: value.id,
              code: value.orderCode,
              amount: value.amountVnd,
              expiresAt: value.expiresAt,
              qrUrl: value.qrUrl,
              ...(value.detail.credit == null ? {} : { credit: value.detail.credit }),
              ...(value.detail.daysLeft == null ? {} : { daysLeft: value.detail.daysLeft }),
          }
        : null
    const onPaid = useCallback(() => {
        void mutate((key) => Array.isArray(key) && key[1] === workspaceId)
    }, [workspaceId])
    const onRegenerate = useCallback(() => {
        if (target && workspaceId) void requestHandler?.(target)
    }, [target, workspaceId, requestHandler])
    return {
        target,
        order,
        workspaceId: workspaceId ?? "",
        bank: value?.bank ?? { account: "", bank: "", holder: "" },
        isRegenerating: isRequesting || payment.isLoading,
        regenerateError: error || (payment.error ? t("errGeneric") : null),
        onRegenerate,
        onPaid,
        onClose: close,
    }
}
