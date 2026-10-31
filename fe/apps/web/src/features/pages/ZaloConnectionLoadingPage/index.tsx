import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { ZaloConnectionLoadingPageBase } from "./component"

const STEPS = ["stepApp", "stepPaste", "stepAuthorize", "stepCheck", "stepAgents"] as const

/** The loading view of one Zalo OA connection: the frame of the page itself with only what is read unresolved. */
export const ZaloConnectionLoadingPage = async () => {
    const t = await getTranslations("zaloConnection")
    return (
        <ZaloConnectionLoadingPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "zalo", label: t("crumbZalo") },
                ],
                title: t("title"),
                mainLabel: t("mainLabel"),
                railLabel: t("eventsTitle"),
                steps: STEPS.map((key) => ({ id: key, title: t(key) })),
            }}
        />
    )
}
