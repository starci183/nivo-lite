import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { WorkspaceNewPageBase } from "./component"

/** The document title of the page. */
export const workspaceNewMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("onboarding")
    return { title: t("newTitle") }
}

/** /workspaces/new: names a new workspace; the proxy sends the signed-out to the sign-in page. */
export const WorkspaceNewPage = async () => {
    const t = await getTranslations("onboarding")
    return (
        <WorkspaceNewPageBase
            props={{
                title: t("newTitle"),
                description: t("nameText"),
            }}
        />
    )
}
