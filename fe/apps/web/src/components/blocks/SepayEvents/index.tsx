"use client"

import { useFormatter, useTranslations } from "next-intl"
import { SEPAY_EVENTS_PLACEHOLDER, useSepayEvents } from "@/hooks/sepayConnection"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { SepayEventView } from "@/modules/types"
import { SepayEventsBase } from "./component"
import type { SepayEventRow } from "./component"

/** What the page hands the panel: the connection of the url. */
type SepayEventsProps = { readonly connectionId: string }

type Translate = ReturnType<typeof useTranslations<"sepayConnection">>

/** The line under a delivery: when, and what became of it. */
const detailOf = (t: Translate, event: SepayEventView, time: string): string => {
    if (event.outcome === "unauthorized") return t("detailRefused", { time })
    if (event.outcome === "duplicate") return t("detailDuplicate", { time })
    return t("detailOk", { time, id: event.providerEventId ?? "-" })
}

const TONES = { accepted: "success", duplicate: "neutral", unauthorized: "danger" } as const

/** The connected live panel of the webhook deliveries of a SePay connection. */
export const SepayEvents = (props: SepayEventsProps) => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { slot, retry } = useSepayEvents(props.connectionId)
    const rowOf = (event: SepayEventView): SepayEventRow => {
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
        const detail = detailOf(t, event, time)
        return {
            id: event.id,
            title,
            statusLabel: t(`outcome_${event.outcome}`),
            statusTone: TONES[event.outcome],
            detail,
        }
    }
    return (
        <SepayEventsBase
            props={{
                title: t("eventsTitle"),
                liveLabel: t("live"),
                slot: mapSlot(slot, (events) => events.map(rowOf)),
                placeholder: SEPAY_EVENTS_PLACEHOLDER.map(rowOf),
                labels: slotLabels(t("eventsEmpty")),
            }}
            on={{ retry }}
        />
    )
}
