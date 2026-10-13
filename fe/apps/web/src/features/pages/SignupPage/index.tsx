import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { inviteNext } from "@/hooks/auth"
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

/** Public sign-up page. `?invite=<token>` carries an invitation through; a signed-in visitor is sent on by the form. */
export const SignupPage = async (props: SignupPageProps) => {
    const { invite, email } = await props.searchParams
    const next = inviteNext(invite)
    return <SignupPageBase props={{ next, invited: next !== undefined, initialEmail: email }} />
}
