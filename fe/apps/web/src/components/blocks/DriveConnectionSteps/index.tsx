"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useDriveChooserView, useDriveHead, useDriveSteps } from "@/hooks/drive"
import { brainTabHref } from "@/modules/routes"
import { DriveConnectionStepsBase } from "./component"

/** The connected setup steps: done or not from the grant and the sources read, the first one not done opens. */
export const DriveConnectionSteps = () => {
    const t = useTranslations("driveConnection")
    const { steps, toggle, standing } = useDriveSteps()
    const { grant, isGranting } = useDriveHead()
    const chooser = useDriveChooserView()
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <DriveConnectionStepsBase
            props={{
                chooser: chooser.props,
                steps,
                stepsLabel: t("stepsLabel"),
                isGranting,
                ...(standing === "none"
                    ? { ungranted: { message: t("emptyTitle"), description: t("emptyBody"), action: t("grant") } }
                    : {}),
                ...(standing === "lost" ? { regrant: { label: t("regrant") } } : {}),
                brain: { label: t("openBrain"), href: brainTabHref("sources") },
            }}
            on={{ toggle, grant, ...chooser.on }}
        />
    )
}
