import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { AgentKnowledgePageBase } from "./component"

/** What the route hands the page: the workspace, the type and the instance of the url. */
type AgentKnowledgePageProps = {
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
}

/** The document title of the knowledge tab. */
export const agentKnowledgeMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_knowledge") }
}

/** The knowledge tab of one instance: the block reads the knowledge of the agent in the browser. */
export const AgentKnowledgePage = (props: AgentKnowledgePageProps): ReactElement => {
    if (!isModuleKey(props.module)) notFound()
    return (
        <AgentKnowledgePageBase
            props={{ workspaceId: props.workspaceId, module: props.module, installationId: props.installationId }}
        />
    )
}

/** The same Knowledge tab while the route loads: the block reads the agent from the address and draws its own skeletons. */
export const AgentKnowledgeLoadingPage = (): ReactElement => (
    <AgentKnowledgePageBase props={{ workspaceId: undefined, module: undefined, installationId: undefined }} />
)
