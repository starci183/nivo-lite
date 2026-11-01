"use client"

import { useDriveRail } from "@/hooks/drive"
import { useSlotLabels } from "@/hooks/slot"
import { useTelegramRail } from "@/hooks/telegramConnection"
import { ConnectionEventsRailBase } from "./component"

/** Which provider the rail serves: the Telegram bot of the url, or the workspace's Google Drive grant. */
type ConnectionEventsRailProps =
    { readonly kind: "telegram"; readonly connectionId: string } | { readonly kind: "drive" }

/**
 * The connected live rail of a provider page: the events of the Telegram bot (real inbound and outbound messages, asked again every
 * few seconds) or the progress of the files read from Drive; the hooks of the provider it does not serve read nothing.
 */
export const ConnectionEventsRail = (props: ConnectionEventsRailProps) => {
    const slotLabels = useSlotLabels()
    const telegram = useTelegramRail(props.kind === "telegram" ? props.connectionId : undefined)
    const drive = useDriveRail(props.kind === "drive")
    const rail = props.kind === "telegram" ? telegram : drive
    return (
        <ConnectionEventsRailBase
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
