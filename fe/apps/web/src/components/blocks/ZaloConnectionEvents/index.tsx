"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloEvents } from "@/hooks/zaloConnection"
import { ZaloConnectionEventsBase } from "./component"

/** What the page hands the panel: the connection of the url. */
interface ZaloConnectionEventsProps {
    readonly connectionId: string
}

/** The connected live rail of a Zalo OA connection, read from the real inbound and outbound messages and asked again every few seconds. */
export const ZaloConnectionEvents = (props: ZaloConnectionEventsProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const { lines, reload } = useZaloEvents(props.connectionId)
    return (
        <ZaloConnectionEventsBase
            props={{
                title: t("eventsTitle"),
                liveLabel: t("eventsLive"),
                footnote: t("eventsFootnote"),
                events: lines,
                slotLabels: slotLabels(t("eventsEmpty")),
            }}
            on={{ retry: reload }}
        />
    )
}
