import { getTranslations } from "next-intl/server"
import { LoadingNotice } from "@/components/composites/LoadingNotice"

/** Shown while a route resolves. */
export const LandingLoadingPage = async () => {
    const t = await getTranslations("app.loading")
    return <LoadingNotice label={t("message")} />
}
