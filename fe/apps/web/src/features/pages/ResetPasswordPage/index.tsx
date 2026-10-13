import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { getPrincipal } from "@/modules/db"
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

/** Set a new password. The recovery link leaves a session; without one (or with an error code) the link is expired. */
export const ResetPasswordPage = async (props: ResetPasswordPageProps) => {
    const { error } = await props.searchParams
    const principal = await getPrincipal()
    return (
        <ResetPasswordPageBase props={{ expired: (error !== undefined && error !== "") || principal.kind !== "ok" }} />
    )
}
