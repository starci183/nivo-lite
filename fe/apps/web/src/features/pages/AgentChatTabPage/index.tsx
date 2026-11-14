import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { AgentChatTabPageBase } from "./component"

/** What the route hands the page: the type and the instance of the url. */
type AgentChatTabPageProps = {
    readonly module: string
    readonly installationId: string
}

/** The document title of the chat tab. */
export const agentChatTabMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_chat") }
}

/** The chat tab of one instance: the room of the viewer with its agent; the page knows only the type. */
export const AgentChatTabPage = async (props: AgentChatTabPageProps): Promise<ReactElement> => {
    if (!isModuleKey(props.module)) notFound()
    const t = await getTranslations("agentChat")
    const room = await getTranslations("teamChat")
    return (
        <AgentChatTabPageBase
            props={{
                installationId: props.installationId,
                gridLabel: t("gridLabel"),
                roomLabel: room("threadLabel"),
            }}
        />
    )
}

/** The same chat tab while the route loads: the pane words stay real, the room reads the agent from the address and draws its skeleton. */
export const AgentChatTabLoadingPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("agentChat")
    const room = await getTranslations("teamChat")
    return (
        <AgentChatTabPageBase
            props={{ installationId: undefined, gridLabel: t("gridLabel"), roomLabel: room("threadLabel") }}
        />
    )
}
