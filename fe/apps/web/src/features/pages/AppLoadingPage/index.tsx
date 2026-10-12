import { getTranslations } from "next-intl/server"
import { AppLoadingPageBase } from "./component"

/** Shown while a route resolves. */
export const AppLoadingPage = async () => {
    const t = await getTranslations("app")
    return <AppLoadingPageBase props={{ label: t("loading") }} />
}
