"use client"

import { useTranslations } from "next-intl"
import { useSalesWaiting } from "@/hooks/salesWaiting"
import { WAITING_ROWS_PLACEHOLDER, useSlotLabels } from "@/hooks/slot"
import { SalesWaitingBase } from "./component"

/** The connected "waiting for you" card of the Sales desk: its pending decisions, each decided in place. */
export const SalesWaiting = () => {
    const frame = useTranslations("agentDashboard")
    const t = useTranslations("workbenchSales")
    const slotLabels = useSlotLabels()
    const waiting = useSalesWaiting()
    return (
        <SalesWaitingBase
            props={{
                slot: waiting.slot,
                placeholder: WAITING_ROWS_PLACEHOLDER,
                slotLabels: slotLabels(frame("waitingEmpty")),
                list: {
                    label: frame("waitingTitle"),
                    count: waiting.count,
                    more: waiting.more,
                    emptyMessage: frame("waitingEmpty"),
                    emptyDescription: frame("waitingEmptyBody"),
                    seeWhyLabel: t("waitingSeeWhy"),
                    moreLabel: t("waitingMoreMenu"),
                },
            }}
            on={{ retry: waiting.reload }}
        />
    )
}
