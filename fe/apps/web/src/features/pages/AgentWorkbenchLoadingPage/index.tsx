import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { AgentWorkbenchLoadingPageBase } from "./component"

/** The workbench slot while it loads: the panes of the ready workbench as skeletons, inside the frame of the agent. */
export const AgentWorkbenchLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("agentDashboard")
    const tc = await getTranslations("modulesCore")
    return (
        <AgentWorkbenchLoadingPageBase
            props={{
                title: tc("tab_workbench"),
                waitingTitle: t("waitingTitle"),
                regions: [
                    { id: "done", label: t("doneTitle") },
                    { id: "connections", label: t("connTitle") },
                    { id: "knowledge", label: t("knowTitle") },
                ],
            }}
        />
    )
}
