import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { inviteNext } from "@/hooks/auth"
import { getPrincipal, readPostAuthPath, readRequestOrigin } from "@/modules/db"
import { navigation } from "@/modules/i18n"
import { SignupPageBase } from "./component"

/** What the route passes through: the query of the sign-up URL. */
interface SignupPageProps {
    readonly searchParams: Promise<{ readonly invite?: string; readonly email?: string }>
}

/** The document title of the page. */
export const signupMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("auth")
    return { title: t("signUpTitle") }
}

/** Public sign-up page. `?invite=<token>` carries an invitation through; a signed-in visitor is sent on to where they belong. */
export const SignupPage = async (props: SignupPageProps) => {
    const { invite, email } = await props.searchParams
    const next = inviteNext(invite)
    const principal = await getPrincipal()
    const origin = await readRequestOrigin()
    if (principal.kind === "ok" && origin !== undefined)
        navigation.redirect({ href: await readPostAuthPath(next, origin), locale: await getLocale() })
    return <SignupPageBase props={{ next, invited: next !== undefined, initialEmail: email }} />
}
