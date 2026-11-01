"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryTelegramConnectionEventsSwr } from "@/hooks/swr"
import type { ConnectionLineView, ConnectionTone, DataSlot } from "@/modules/types"
import { TELEGRAM_EVENTS_POLL_MS } from "./telegramConnection.shared"

/** The badge tone of each outcome the back end names; anything else did not get through. */
const OUTCOME_TONES: Readonly<Record<string, ConnectionTone>> = { received: "neutral", sent: "success" }

/**
 * The live panel: customer messages and the agent's replies, newest first, asked again every few seconds. A line carries who and when,
 * never what was written: the back end sends no message text.
 */
export const useTelegramEvents = (connectionId: string | undefined) => {
    const t = useTranslations("telegramConnection")
    const format = useFormatter()
    const read = useQueryTelegramConnectionEventsSwr(connectionId, { refreshInterval: TELEGRAM_EVENTS_POLL_MS })
    const titles: Readonly<Record<string, string>> = {
        received: t("eventUserMessage"),
        sent: t("eventReplySent"),
    }
    const labels: Readonly<Record<string, string>> = { received: t("outcomeReceived"), sent: t("outcomeSent") }

    const lines: DataSlot<ReadonlyArray<ConnectionLineView>> = mapSlot(slotOfSwr(read), (events) =>
        events.map((event) => {
            const time = format.dateTime(new Date(event.at), { timeStyle: "short", dateStyle: "short" })
            const who = event.who === "" ? "" : t("eventWho", { who: event.who })
            return {
                id: event.id,
                title: titles[event.outcome] ?? t("eventReplyNotSent"),
                description: [who, time].filter(Boolean).join(" · "),
                badge: {
                    label: labels[event.outcome] ?? t("outcomeNotSent"),
                    tone: OUTCOME_TONES[event.outcome] ?? "danger",
                },
            }
        }),
    )
    return { lines, reload: () => void read.mutate() }
}
