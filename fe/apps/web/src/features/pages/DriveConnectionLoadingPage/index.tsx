import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PHASES } from "@/modules/connection-lifecycle"
import { DriveConnectionLoadingPageBase } from "./component"

/** The loading view of the Google Drive page body: the shape of the page with only what is read unresolved. */
export const DriveConnectionLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("driveConnection")
    const tc = await getTranslations("connections")
    const steps = CONNECTION_PHASES.map((phase) => ({ id: phase, title: tc(`phase_${phase}`) }))
    return (
        <DriveConnectionLoadingPageBase
            props={{ steps, title: t("servicesTitle"), mainLabel: t("mainLabel"), railLabel: t("progressTitle") }}
        />
    )
}
