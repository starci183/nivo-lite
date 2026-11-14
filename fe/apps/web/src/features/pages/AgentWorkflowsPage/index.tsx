import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { AgentWorkflowsPageBase } from "./component"

/** What the route hands the page: the type and the instance of the url. */
type AgentWorkflowsPageProps = {
    readonly module: string
    readonly installationId: string
}

/** The document title of the Workflows tab. */
export const agentWorkflowsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentWorkflows")
    return { title: t("tabWorkflows") }
}

/** The Workflows tab of one instance: the connected block reads the workflows in the browser. */
export const AgentWorkflowsPage = (props: AgentWorkflowsPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    return <AgentWorkflowsPageBase props={{ module: props.module, installationId: props.installationId }} />
}

/** The same Workflows tab while the route loads: the block reads the agent from the address and draws its own skeletons. */
export const AgentWorkflowsLoadingPage = () => (
    <AgentWorkflowsPageBase props={{ module: undefined, installationId: undefined }} />
)
