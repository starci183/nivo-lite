import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { WorkspaceReadyPageBase } from "./component"

/** The document title of the page. */
export const workspaceReadyPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("onboarding")
    return { title: t("readyTitle") }
}

/** /workspaces/new/done: a step of the first-run wizard; the proxy sends the signed-out to the sign-in page. */
export const WorkspaceReadyPage = async () => {
    const t = await getTranslations("onboarding")
    return (
        <WorkspaceReadyPageBase
            props={{
                stepsLabel: t("welcomeStepsLabel"),
                steps: [t("trackStep1"), t("trackStep2"), t("trackStep3")],
            }}
        />
    )
}
