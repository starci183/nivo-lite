"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useDriveRail } from "@/hooks/drive"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useTelegramRail } from "@/hooks/telegramConnection"
import { useZaloEventsView } from "@/hooks/zaloConnection"
import type { ConnectionLineView } from "@/modules/types"
import { ConnectionPageRailBase } from "./component"

/** Which provider the rail serves: the Telegram bot of the url, or the workspace Google Drive grant. */
type ConnectionPageRailProps =
    { readonly kind: "telegram" | "zalo"; readonly connectionId: string } | { readonly kind: "drive" }

/** The connected live rail of a provider connection page; nothing for a member who may not read the page. */
export const ConnectionPageRail = (props: ConnectionPageRailProps) => {
    const slotLabels = useSlotLabels()
    const refusal = useConnectionRefusal()
    const telegram = useTelegramRail(props.kind === "telegram" ? props.connectionId : undefined)
    const drive = useDriveRail(props.kind === "drive")
    const zalo = useZaloEventsView(props.kind === "zalo" ? props.connectionId : "")
    const zaloRail = {
        title: zalo.events.title,
        liveLabel: zalo.events.liveLabel,
        footnote: zalo.events.footnote,
        emptyLabel: zalo.events.slotLabels.empty,
        lines: mapSlot(zalo.events.lines, (lines): ReadonlyArray<ConnectionLineView> =>
            lines.map((event) => ({
                id: event.id,
                title: event.title,
                description: event.detail,
                badge: { label: event.outcomeLabel, tone: event.outcomeTone },
            })),
        ),
        retry: zalo.retry,
    }
    const lineRail = props.kind === "telegram" ? telegram : drive
    const rail = props.kind === "zalo" ? zaloRail : lineRail
    if (refusal !== undefined) return null
    return (
        <ConnectionPageRailBase
            props={{
                title: rail.title,
                liveLabel: rail.liveLabel,
                footnote: rail.footnote,
                lines: rail.lines,
                slotLabels: slotLabels(rail.emptyLabel),
            }}
            on={{ retry: rail.retry }}
        />
    )
}
