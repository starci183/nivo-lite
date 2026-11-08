import type { ReactNode, ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { AuthLayoutBase } from "./component"

/** What the auth route group hands the layout: the routed card. */
type AuthLayoutProps = { readonly children: ReactNode }

/** The frame of sign-in, sign-up, forgot and reset password: the routed card centred on the page. */
export const AuthLayout = async (props: AuthLayoutProps): Promise<ReactElement> => {
    const t = await getTranslations("login")
    return (
        <AuthLayoutBase
            props={{
                mainLabel: t("mainLabel"),
                legalLabel: t("legalLabel"),
                privacyLabel: t("privacyLink"),
                termsLabel: t("termsLink"),
            }}
        >
            {props.children}
        </AuthLayoutBase>
    )
}
