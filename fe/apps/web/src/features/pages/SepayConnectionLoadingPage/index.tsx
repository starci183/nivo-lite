import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { SepayConnectionLoadingPageBase } from "./component"

const STEPS = ["stepEnvironment", "stepAccount", "stepPaste", "checklistTitle", "stepAgents"] as const

/** The loading view of one SePay connection: the frame of the page itself with only what is read unresolved. */
export const SepayConnectionLoadingPage = async () => {
    const t = await getTranslations("sepayConnection")
    return (
        <SepayConnectionLoadingPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
                    { id: "sepay", label: t("title") },
                ],
                title: t("title"),
                mainLabel: t("mainLabel"),
                railLabel: t("eventsTitle"),
                steps: STEPS.map((key) => ({ id: key, title: t(key) })),
            }}
        />
    )
}
