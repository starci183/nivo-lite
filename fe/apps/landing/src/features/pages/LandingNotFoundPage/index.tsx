import { getTranslations } from "next-intl/server"
import { NotFoundNotice } from "@/components/composites/NotFoundNotice"
import { LANDING_ROUTES } from "@/modules/routes"

import type { ReactElement } from "react"

/** Shown when a route does not exist. */
export const LandingNotFoundPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("app.notFound")
    return <NotFoundNotice title={t("title")} homeLabel={t("home")} homeHref={LANDING_ROUTES.home} />
}
