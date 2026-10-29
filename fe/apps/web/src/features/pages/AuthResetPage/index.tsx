import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { navigation } from "@/modules/i18n"
import { safeNext } from "@/modules/routes"

/** What the route passes through: the query of the mailed link. */
interface AuthResetPageProps {
    readonly searchParams: Promise<{ readonly token?: string; readonly next?: string }>
}

const SITE_BASE = "http://localhost"

/** The document title of the page. */
export const authResetMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("login")
    return { title: t("signInTitle") }
}

/** `/auth/reset?token=`: the mailed link to set a password opens the reset page, which spends the token with the new password. */
export const AuthResetPage = async (props: AuthResetPageProps) => {
    const { token, next } = await props.searchParams
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    const search = new URLSearchParams()
    if (token !== undefined && token !== "") search.set("token", token)
    const target = safeNext(next, SITE_BASE)
    if (target !== undefined) search.set("next", target)
    const query = search.toString()
    return navigation.redirect({ href: query === "" ? "/reset-password" : `/reset-password?${query}`, locale })
}
