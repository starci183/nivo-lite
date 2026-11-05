import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { DriveConnectionLoadingPageBase } from "./component"

const STEPS = ["stepGrant", "stepChoose", "stepBrain"] as const

/** The loading view of the Google Drive page: the frame of the page itself with only what is read unresolved. */
export const DriveConnectionLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("driveConnection")
    return (
        <DriveConnectionLoadingPageBase
            props={{
                title: t("title"),
                mainLabel: t("mainLabel"),
                railLabel: t("progressTitle"),
                steps: STEPS.map((key) => ({ id: key, title: t(key) })),
            }}
        />
    )
}
