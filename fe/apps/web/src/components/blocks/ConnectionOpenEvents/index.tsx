"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useConnectionOpenPage } from "@/hooks/connectionsPanes"
import { ConnectionOpenEventsBase } from "./component"

/**
 * The connected events card of a connection without a page of its own. The back end reports no event feed for these providers, only
 * the time of the latest event, so that is the one line the card can show.
 */
export const ConnectionOpenEvents = () => {
    const tc = useTranslations("connections")
    const open = useConnectionOpenPage()
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ConnectionOpenEventsBase
            props={{
                title: tc("eventsTitle"),
                liveLabel: tc("eventsLive"),
                emptyMessage: tc("eventsEmpty"),
                emptyHint: tc("eventsEmptyHint"),
                lines:
                    open.event === null
                        ? []
                        : [{ id: "latest", title: open.event.title, description: open.event.description }],
                isLoading: !("items" in open.slot),
            }}
        />
    )
}
