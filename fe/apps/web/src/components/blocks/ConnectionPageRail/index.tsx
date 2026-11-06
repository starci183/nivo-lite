"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useDriveRail } from "@/hooks/drive"
import { useSlotLabels } from "@/hooks/slot"
import { ConnectionPageRailBase } from "./component"

/** The connected live rail of the Google Drive connection page; nothing for a member who may not read the page. */
export const ConnectionPageRail = () => {
    const slotLabels = useSlotLabels()
    const refusal = useConnectionRefusal()
    const rail = useDriveRail(true)
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
