"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useDriveHead, useDriveSteps } from "@/hooks/drive"
import { brainTabHref } from "@/modules/routes"
import { DriveConnectionStepsBase } from "./component"

/** What the page hands the steps: the connected body of the choose step. */
interface DriveConnectionStepsProps {
    readonly shape: { readonly choose: ReactNode }
}

/** The connected setup steps: done or not from the grant and the sources read, the first one not done opens. */
export const DriveConnectionSteps = (props: DriveConnectionStepsProps) => {
    const t = useTranslations("driveConnection")
    const { steps, toggle, standing } = useDriveSteps()
    const { grant, isGranting } = useDriveHead()
    return (
        <DriveConnectionStepsBase
            shape={props.shape}
            props={{
                steps,
                stepsLabel: t("stepsLabel"),
                isGranting,
                ...(standing === "none"
                    ? { ungranted: { message: t("emptyTitle"), description: t("emptyBody"), action: t("grant") } }
                    : {}),
                ...(standing === "lost" ? { regrant: { label: t("regrant") } } : {}),
                brain: { label: t("openBrain"), href: brainTabHref("sources") },
            }}
            on={{ toggle, grant }}
        />
    )
}
