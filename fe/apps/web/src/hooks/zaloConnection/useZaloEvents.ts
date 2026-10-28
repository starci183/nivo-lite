"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryZaloConnectionEventsSwr } from "@/hooks/swr"
import type { DataSlot, ZaloEventLineView, ZaloTone } from "@/modules/types"
import { ZALO_EVENTS_POLL_MS } from "./zaloConnection.shared"

/** The live panel: the recent events of the OA, newest first, asked again every few seconds. */
export const useZaloEvents = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const format = useFormatter()
    const read = useQueryZaloConnectionEventsSwr(connectionId, { refreshInterval: ZALO_EVENTS_POLL_MS })

    const titleOf = (kind: string): string => {
        switch (kind) {
            case "user_send_text":
                return t("eventUserSendText")
            case "follow":
                return t("eventFollow")
            case "renewal_qr":
                return t("eventRenewalQr")
            default:
                return t("eventAgentReply")
        }
    }
    const reasonOf = (reason: string | null): string => {
        if (reason === null) return t("reasonOther")
        switch (reason) {
            case "token_expired":
                return t("reasonTokenExpired")
            case "zalo_window_expired":
                return t("reasonWindowExpired")
            case "zalo_not_connected":
                return t("reasonNotConnected")
            case "zalo_unfollowed":
                return t("reasonUnfollowed")
            case "zalo_night_hours":
                return t("reasonNightHours")
            case "zalo_token":
                return t("reasonToken")
            case "zalo_recipient":
                return t("reasonRecipient")
            case "zalo_template":
                return t("reasonTemplate")
            case "zalo_quota":
                return t("reasonQuota")
            case "zalo_not_permitted":
                return t("reasonNotPermitted")
            default:
                return t("reasonOther")
        }
    }
    const outcomeOf = (outcome: string): { readonly label: string; readonly tone: ZaloTone } => {
        if (outcome === "received") return { label: t("outcomeReceived"), tone: "success" }
        if (outcome === "sent") return { label: t("outcomeSent"), tone: "success" }
        return { label: t("outcomeNotSent"), tone: "danger" }
    }

    const lines: DataSlot<ReadonlyArray<ZaloEventLineView>> = mapSlot(slotOfSwr(read), (events) =>
        events.map((event) => {
            const outcome = outcomeOf(event.outcome)
            const time = format.dateTime(new Date(event.at), { timeStyle: "short", dateStyle: "short" })
            const quoted = event.text === "" ? "" : `“${event.text}”`
            const detail =
                event.outcome === "not_sent"
                    ? t("detailNotSent", { time, reason: reasonOf(event.reason) })
                    : [time, event.who, quoted].filter((part) => part !== "").join(" · ")
            return {
                id: event.id,
                title: titleOf(event.kind),
                outcomeLabel: outcome.label,
                outcomeTone: outcome.tone,
                detail,
            }
        }),
    )
    return { lines, reload: () => void read.mutate() }
}
