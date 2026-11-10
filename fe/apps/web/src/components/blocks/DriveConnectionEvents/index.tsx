"use client"

import { useTranslations } from "next-intl"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useConnectionRefusal } from "@/hooks/connections"
import { useDriveHead, useDriveLife, useDriveRail, useDrivePage } from "@/hooks/drive"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { DriveConnectionEventsBase } from "./component"

/** The rail's step while Drive is off: grant it again when Google revoked it, else turn it on, as the services row does. */
const turnOnLabelOf = (standing: string | undefined, grantAgain: string, turnOn: string): string =>
    standing === "lost" ? grantAgain : turnOn

/**
 * The connected live rail of the Google Drive connection: the files NIVO is reading from Drive and where each one stands (read again
 * every few seconds, since Drive sends no webhook), with a retry on a failed one. Nothing for a member who may not read the page.
 */
export const DriveConnectionEvents = () => {
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const t = useTranslations("driveConnection")
    const rail = useDriveRail(true)
    const router = navigation.useRouter()
    const tabs = useConnectionPageTabs(undefined)
    const { slot } = useDrivePage()
    const standing = "items" in slot ? slot.items.standing : undefined
    const isGranted = standing === "connected"
    const { grant } = useDriveHead()
    const { life } = useDriveLife()
    // The band shows a filled primary while Drive needs action or waits (grant again, continue the setup): the rail's step stays neutral then.
    const bandHasPrimary = life?.id === "attention" || life?.id === "waiting"
    const emptyActionLabel = isGranted
        ? t("serviceFolders")
        : turnOnLabelOf(standing, tc("actionGrantAgain"), t("railEnableDrive"))
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <DriveConnectionEventsBase
            props={{
                title: rail.title,
                liveLabel: rail.liveLabel,
                emptyMessage: rail.emptyLabel,
                emptyHint: isGranted ? tc("eventsEmptyHint") : t("railDriveOffHint"),
                ...(standing === undefined ? {} : { emptyActionLabel }),
                emptyActionIntent: bandHasPrimary ? "neutral" : "commit",
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
            on={{ retry: rail.retry, emptyAction: isGranted ? () => router.push(tabs.hrefOf("settings")) : grant }}
        />
    )
}
