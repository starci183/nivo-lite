import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { WorkspaceChannelsPageBase } from "./component"

/** The document title of the page. */
export const workspaceChannelsPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("onboarding")
    return { title: t("channelsTitle") }
}

/** /workspaces/new/channels: a step of the first-run wizard; the proxy sends the signed-out to the sign-in page. */
export const WorkspaceChannelsPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("onboarding")
    return (
        <WorkspaceChannelsPageBase
            props={{
                stepsLabel: t("welcomeStepsLabel"),
                steps: [t("trackStep1"), t("trackStep2"), t("trackStep3"), t("trackStep4")],
                descriptions: [t("trackStep1Text"), t("trackStep2Text"), t("trackStep3Text"), t("trackStep4Text")],
            }}
        />
    )
}
