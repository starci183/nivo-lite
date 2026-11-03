"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloEvents } from "./useZaloEvents"

/** The live rail of a Zalo OA connection in the words of the reader, read from the real inbound and outbound messages. */
export const useZaloEventsView = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const { lines, reload } = useZaloEvents(connectionId)
    return {
        events: {
            title: t("eventsTitle"),
            liveLabel: t("eventsLive"),
            footnote: t("eventsFootnote"),
            lines,
            slotLabels: slotLabels(t("eventsEmpty")),
        },
        retry: reload,
    }
}
