"use client"
import { useTranslations } from "next-intl"
import { useCreditsHistory } from "@/hooks/credits"
import { loadingSlot } from "@/hooks/slot"
import { CreditsHistoryBase } from "./component"

/** Connects the independent payment history slot. */
export const CreditsHistory = () => {
    const history = useCreditsHistory()
    return <CreditsHistoryBase {...history} />
}

/** Resolves history labels for the route-loading placeholder. */
export const CreditsHistorySkeleton = () => {
    const t = useTranslations("credits")
    return (
        <CreditsHistoryBase
            props={{
                title: t("paymentsTitle"),
                loading: t("loading"),
                slot: loadingSlot(),
                labels: {
                    empty: t("paymentsEmpty"),
                    forbidden: t("errForbidden"),
                    error: t("errorText"),
                    retry: t("retry"),
                },
            }}
            on={{ retry: () => undefined }}
        />
    )
}
