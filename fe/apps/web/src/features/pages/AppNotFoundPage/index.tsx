import { getTranslations } from "next-intl/server"
import { APP_ROUTES } from "@/modules/routes"
import { AppNotFoundPageBase } from "./component"

/** Shown when a route does not exist. */
export const AppNotFoundPage = async () => {
    const t = await getTranslations("app")
    return (
        <AppNotFoundPageBase
            props={{
                title: t("notFoundTitle"),
                text: t("notFoundText"),
                homeLabel: t("notFoundHome"),
                homeHref: APP_ROUTES.dashboard,
            }}
        />
    )
}
