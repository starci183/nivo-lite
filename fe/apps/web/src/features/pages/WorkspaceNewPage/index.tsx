import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { getPrincipal } from "@/modules/db"
import { navigation } from "@/modules/i18n"
import { loginPath } from "@/modules/routes"
import { WorkspaceNewPageBase } from "./component"

/** The document title of the page. */
export const workspaceNewMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("onboarding")
    return { title: t("newTitle") }
}

/** /workspaces/new: names a new workspace; the signed-out go to the sign-in page. */
export const WorkspaceNewPage = async () => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") navigation.redirect({ href: loginPath(), locale: await getLocale() })
    const t = await getTranslations("onboarding")
    return (
        <WorkspaceNewPageBase
            props={{
                email: principal.kind === "ok" ? (principal.value.email ?? "") : "",
                title: t("newTitle"),
                description: t("nameText"),
            }}
        />
    )
}
