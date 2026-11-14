"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useDriveRail, useDrivePage } from "@/hooks/drive"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { DriveConnectionEventsBase } from "./component"

/**
 * The connected live rail of the Google Drive connection: the files NIVO is reading from Drive and where each one stands (read again
 * every few seconds, since Drive sends no webhook), with a retry on a failed one. Nothing for a member who may not read the page.
 */
export const DriveConnectionEvents = () => {
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const t = useTranslations("driveConnection")
    const rail = useDriveRail(true)
    const { slot } = useDrivePage()
    const standing = "items" in slot ? slot.items.standing : undefined
    const isGranted = standing === "connected"
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <DriveConnectionEventsBase
            props={{
                title: rail.title,
                liveLabel: rail.liveLabel,
                emptyMessage: rail.emptyLabel,
                emptyHint: isGranted ? tc("eventsEmptyHint") : t("railDriveOffHint"),
                isLive: isGranted,
                lines: mapSlot(rail.lines, (lines) =>
                    lines.map((line) => ({
                        id: line.id,
                        title: line.title,
                        description: line.description,
                        badge: line.badge,
                        ...(line.action === undefined ? {} : { action: line.action }),
                    })),
                ),
                slotLabels: slotLabels(rail.emptyLabel),
            }}
            on={{ retry: rail.retry }}
        />
    )
}
