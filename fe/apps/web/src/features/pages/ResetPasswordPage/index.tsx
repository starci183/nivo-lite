import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ResetPasswordPageBase } from "./component"

/** What the route passes through: the query of the reset URL. */
interface ResetPasswordPageProps {
    readonly searchParams: Promise<{ readonly error?: string }>
}

/** The document title of the page. */
export const resetPasswordMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("auth")
    return { title: t("resetTitle") }
}

/** Set a new password. The recovery link leaves a session; with an error code the link is expired (the form also checks the session). */
export const ResetPasswordPage = async (props: ResetPasswordPageProps) => {
    const { error } = await props.searchParams
    return <ResetPasswordPageBase props={{ expired: error !== undefined && error !== "" }} />
}
