import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { confirmEmail } from "@/modules/auth"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, safeNext } from "@/modules/routes"

/** What the route passes through: the query of the mailed link. */
interface AuthConfirmPageProps {
    readonly searchParams: Promise<{ readonly token?: string; readonly next?: string }>
}

const SITE_BASE = "http://localhost"

/** The document title of the page. */
export const authConfirmMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("login")
    return { title: t("signInTitle") }
}

const loginHref = (query: Readonly<Record<string, string | undefined>>): string => {
    const search = new URLSearchParams()
    for (const [name, value] of Object.entries(query)) if (value) search.set(name, value)
    return search.size > 0 ? `${APP_ROUTES.login}?${search.toString()}` : APP_ROUTES.login
}

/** `/auth/confirm?token=`: spends the confirmation link of a new account, then opens the sign-in page with the outcome. */
export const AuthConfirmPage = async (props: AuthConfirmPageProps) => {
    const { token, next } = await props.searchParams
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    if (token === undefined || token === "") {
        // An older invitation mail carries only the page to continue to.
        return navigation.redirect({ href: loginHref({ next: safeNext(next, SITE_BASE) }), locale })
    }
    const outcome = await confirmEmail(token)
    return navigation.redirect({
        href: loginHref(outcome.success ? { notice: "confirmed" } : { error: "link_expired" }),
        locale,
    })
}
