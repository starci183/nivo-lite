import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { DriveConnectionLoadingPageBase } from "./component"

const STEPS = ["stepGrant", "stepChoose", "stepBrain"] as const

/** The loading view of the Google Drive page: the frame of the page itself with only what is read unresolved. */
export const DriveConnectionLoadingPage = async () => {
    const t = await getTranslations("driveConnection")
    return (
        <DriveConnectionLoadingPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "drive", label: t("crumbDrive") },
                ],
                title: t("title"),
                mainLabel: t("mainLabel"),
                railLabel: t("progressTitle"),
                steps: STEPS.map((key) => ({ id: key, title: t(key) })),
            }}
        />
    )
}
