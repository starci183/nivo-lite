import { getTranslations } from "next-intl/server"
import { LoadingNotice } from "@/components/composites/LoadingNotice"

import type { ReactElement } from "react"

/** Shown while a route resolves. */
export const LandingLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("app.loading")
    return <LoadingNotice label={t("message")} />
}
