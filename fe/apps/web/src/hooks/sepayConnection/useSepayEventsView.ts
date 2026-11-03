"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, SepayEventView, SlotLabels } from "@/modules/types"
import { SEPAY_EVENTS_PLACEHOLDER } from "./sepayConnection.shared"
import { useSepayEvents } from "./useSepayEvents"

type Translate = ReturnType<typeof useTranslations<"sepayConnection">>

/** The line under a delivery: when, and what became of it. */
const detailOf = (t: Translate, event: SepayEventView, time: string): string => {
    if (event.outcome === "unauthorized") return t("detailRefused", { time })
    if (event.outcome === "duplicate") return t("detailDuplicate", { time })
    return t("detailOk", { time })
}

const TONES = { accepted: "success", duplicate: "neutral", unauthorized: "danger" } as const

type UseSepayEventsViewResult = {
    events: {
        title: string
        liveLabel: string
        footnote: string
        slot: DataSlot<
            {
                id: string
                title: string
                statusLabel: string
                statusTone: "success" | "neutral" | "danger"
                detail: string
            }[]
        >
        placeholder: {
            id: string
            title: string
            statusLabel: string
            statusTone: "success" | "neutral" | "danger"
            detail: string
        }[]
        labels: SlotLabels
    }
    retry: () => void
}

/** The live rail of the webhook deliveries of a SePay connection in the words of the reader. */
export const useSepayEventsView = (connectionId: string): UseSepayEventsViewResult => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { slot, retry } = useSepayEvents(connectionId)
    const rowOf = (event: SepayEventView) => {
        const time = format.dateTime(new Date(event.at), { timeStyle: "short" })
        const title =
            event.kind === "ping"
                ? t(event.outcome === "unauthorized" ? "eventRefused" : "eventPing")
                : t(event.kind === "credit" ? "eventCredit" : "eventDebit", {
                      amount: format.number(event.amountVnd ?? 0, {
                          style: "currency",
                          currency: "VND",
                          maximumFractionDigits: 0,
                      }),
                  })
        return {
            id: event.id,
            title,
            statusLabel: t(`outcome_${event.outcome}`),
            statusTone: TONES[event.outcome],
            detail: detailOf(t, event, time),
        }
    }
    return {
        events: {
            title: t("eventsTitle"),
            liveLabel: t("live"),
            footnote: t("eventsFootnote"),
            slot: mapSlot(slot, (events) => events.map(rowOf)),
            placeholder: SEPAY_EVENTS_PLACEHOLDER.map(rowOf),
            labels: slotLabels(t("eventsEmpty")),
        },
        retry,
    }
}
