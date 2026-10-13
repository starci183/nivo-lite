import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LoginPageBase } from "./component"

/** What the route passes through: the query of the sign-in URL. */
interface LoginPageProps {
    readonly searchParams: Promise<{ readonly error?: string; readonly notice?: string; readonly next?: string }>
}

/** The document title of the page. */
export const loginMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("login")
    return { title: t("signInTitle") }
}

/** Public sign-in page: passes the destination (the sign-in actions sanitise it against the page origin), the failure code of a finished /auth route and the success note. */
export const LoginPage = async (props: LoginPageProps) => {
    const { error, notice, next } = await props.searchParams
    return <LoginPageBase props={{ next: next === "" ? undefined : next, errorCode: error, notice }} />
}
