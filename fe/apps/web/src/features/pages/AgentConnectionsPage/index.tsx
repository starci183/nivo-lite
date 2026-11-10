import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { AgentConnectionsPageBase } from "./component"

/** What the route hands the page: the workspace, the type and the instance of the url. */
type AgentConnectionsPageProps = {
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
}

/** The document title of the connections tab. */
export const agentConnectionsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_connections") }
}

/** The connections tab of one instance: the block reads the grants of the agent in the browser. */
export const AgentConnectionsPage = (props: AgentConnectionsPageProps): ReactElement => {
    if (!isModuleKey(props.module)) notFound()
    return (
        <AgentConnectionsPageBase
            props={{ workspaceId: props.workspaceId, module: props.module, installationId: props.installationId }}
        />
    )
}
