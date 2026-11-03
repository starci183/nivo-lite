import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { AppLoadingPageBase } from "./component"

/** Shown while a route resolves. */
export const AppLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("app")
    return <AppLoadingPageBase props={{ label: t("loading") }} />
}
