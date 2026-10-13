import { getTranslations } from "next-intl/server"
import { AgentWorkbenchLoadingPageBase } from "./component"

/** The workbench slot while it loads: a card with its content as a skeleton, inside the frame of the agent. */
export const AgentWorkbenchLoadingPage = async () => {
    const t = await getTranslations("modulesCore")
    return <AgentWorkbenchLoadingPageBase props={{ title: t("workbenchTitle") }} />
}
