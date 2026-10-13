import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ForgotPasswordPageBase } from "./component"

/** What the route passes through: the query of the forgot-password URL. */
interface ForgotPasswordPageProps {
    readonly searchParams: Promise<{ readonly email?: string }>
}

/** The document title of the page. */
export const forgotPasswordMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("auth")
    return { title: t("forgotTitle") }
}

/** Public "forgot password" page; `?email=` pre-fills the field. */
export const ForgotPasswordPage = async (props: ForgotPasswordPageProps) => {
    const { email } = await props.searchParams
    return <ForgotPasswordPageBase props={{ initialEmail: email }} />
}
