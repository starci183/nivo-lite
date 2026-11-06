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

/** The chat tab of one instance: the panel reads the instance in the browser; the page knows only the type. */
export const AgentChatTabPage = (props: AgentChatTabPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    return <AgentChatTabPageBase props={{ module: props.module, installationId: props.installationId }} />
}
