import type { Metadata } from "next"
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

/** The document title of the not-found page. */
export const appNotFoundMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app")
    return { title: t("notFoundTitle") }
}
