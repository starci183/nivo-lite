import { getTranslations } from "next-intl/server"
import { CONNECTION_ROUTES, URL_PARAMS } from "@/hooks/connections"
import { ConnectionsLoadingPageBase } from "./component"

/** The loading view of the Connections route: the page's own tree with only the figures unresolved. */
export const ConnectionsLoadingPage = async () => {
    const t = await getTranslations("connections")
    return (
        <ConnectionsLoadingPageBase
            props={{
                title: t("title"),
                description: t("description"),
                crumbLabel: t("crumbLabel"),
                crumbHome: t("crumbHome"),
                homeHref: CONNECTION_ROUTES.dashboard,
                connectedLabel: t("tabConnected"),
                libraryLabel: t("tabLibrary"),
                automationsLink: t("automationsLink"),
                automationsHref: CONNECTION_ROUTES.automations,
                addLabel: t("add"),
                addHref: `${CONNECTION_ROUTES.connections}?${URL_PARAMS.tab}=library`,
            }}
        />
    )
}
