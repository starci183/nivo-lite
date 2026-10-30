import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { WorkspaceHandoverPageBase } from "./component"

/** The document title of the page. */
export const workspaceHandoverPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("onboarding")
    return { title: t("handoverTitle") }
}

/** /workspaces/new/ai: a step of the first-run wizard; the proxy sends the signed-out to the sign-in page. */
export const WorkspaceHandoverPage = async () => {
    const t = await getTranslations("onboarding")
    return (
        <WorkspaceHandoverPageBase
            props={{
                stepsLabel: t("welcomeStepsLabel"),
                steps: [t("trackStep1"), t("trackStep2"), t("trackStep3")],
            }}
        />
    )
}
