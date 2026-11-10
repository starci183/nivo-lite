"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSepayEventsView } from "@/hooks/sepayConnection"
import { mapSlot } from "@/hooks/slot"
import { SepayRailBase } from "./component"

/** The connection of the url. */
type SepayRailProps = { readonly connectionId: string }

/** The connected live events of a SePay connection page; nothing for a member who may not read the page. */
export const SepayRail = (props: SepayRailProps) => {
    const tc = useTranslations("connections")
    const rail = useSepayEventsView(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <SepayRailBase
            props={{
                title: rail.events.title,
                liveLabel: tc("eventsLive"),
                emptyMessage: tc("eventsEmpty"),
                emptyHint: tc("eventsEmptyHint"),
                lines: mapSlot(rail.events.slot, (rows) =>
                    rows.map((row) => ({
                        id: row.id,
                        title: row.title,
                        description: row.detail,
                        badge: { label: row.statusLabel, tone: row.statusTone },
                        ...(row.statusTone === "neutral" ? {} : { verdict: row.statusTone }),
                    })),
                ),
                slotLabels: rail.events.labels,
            }}
            on={{ retry: rail.retry }}
        />
    )
}
