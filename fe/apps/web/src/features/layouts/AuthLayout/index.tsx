import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"
import { AuthLayoutBase } from "./component"

/** What the auth route group hands the layout: the routed card. */
type AuthLayoutProps = { readonly children: ReactNode }

/** The frame of sign-in, sign-up, forgot and reset password: the brand pitch beside the routed card. */
export const AuthLayout = async (props: AuthLayoutProps) => {
    const t = await getTranslations("login")
    return (
        <AuthLayoutBase
            props={{
                aboutLabel: t("aboutLabel"),
                mainLabel: t("mainLabel"),
                headline: t("headline"),
                tagline: t("tagline"),
                legalLabel: t("legalLabel"),
                privacyLabel: t("privacyLink"),
                termsLabel: t("termsLink"),
            }}
        >
            {props.children}
        </AuthLayoutBase>
    )
}
