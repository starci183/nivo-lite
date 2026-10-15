import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The document title of the front address, which only forwards. */
export const homeRedirectMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app")
    return { title: t("title") }
}

/** The front address of the console forwards to the dashboard. */
export const HomeRedirectPage = async () =>
    navigation.redirect({ href: CONSOLE_ROUTES.dashboard, locale: (await getLocale()) === "en" ? "en" : "vi" })
