import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ResetPasswordPageBase } from "./component"

/** What the route passes through: the query of the reset URL. */
interface ResetPasswordPageProps {
    readonly searchParams: Promise<{ readonly error?: string; readonly token?: string }>
}

/** The document title of the page. */
export const resetPasswordMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("auth")
    return { title: t("resetTitle") }
}

/** Set a new password. The recovery link carries its one-time token; with an error code, or without a token, the link is expired. */
export const ResetPasswordPage = async (props: ResetPasswordPageProps) => {
    const { error, token } = await props.searchParams
    const hasToken = token !== undefined && token !== ""
    return (
        <ResetPasswordPageBase
            props={{ expired: (error !== undefined && error !== "") || !hasToken, token: token ?? "" }}
        />
    )
}
