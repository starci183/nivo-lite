import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { AgentWorkflowGraph } from "@/components/blocks/AgentWorkflowGraph"
import { isModuleKey } from "@/modules/catalog"

/** What the route hands the page: the type and the instance of the url. */
type AgentGraphTabPageProps = {
    readonly module: string
    readonly installationId: string
}

/** The document title of the Graph tab. */
export const agentGraphTabMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_graph") }
}

/** The Graph tab of one instance: its workflows on one canvas. */
export const AgentGraphTabPage = (props: AgentGraphTabPageProps): ReactElement => {
    if (!isModuleKey(props.module)) notFound()
    return <AgentWorkflowGraph module={props.module} installationId={props.installationId} />
}

/** The same Graph tab while the route loads: the canvas reads the agent from the address and draws its own skeleton. */
export const AgentGraphTabLoadingPage = (): ReactElement => <AgentWorkflowGraph />
