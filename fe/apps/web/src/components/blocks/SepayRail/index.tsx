"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useSepayEventsView } from "@/hooks/sepayConnection"
import { SepayRailBase } from "./component"

/** The connection of the url. */
type SepayRailProps = { readonly connectionId: string }

/** The connected live rail of a SePay connection page; nothing for a member who may not read the page. */
export const SepayRail = (props: SepayRailProps) => {
    const rail = useSepayEventsView(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <SepayRailBase
            props={{
                title: rail.events.title,
                liveLabel: rail.events.liveLabel,
                footnote: rail.events.footnote,
                slot: rail.events.slot,
                placeholder: rail.events.placeholder,
                labels: rail.events.labels,
            }}
            on={{ retry: rail.retry }}
        />
    )
}
