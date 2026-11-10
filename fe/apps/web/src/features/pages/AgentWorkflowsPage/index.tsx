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

/** The document title of the workflows section of setup. */
export const agentWorkflowsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentWorkflows")
    return { title: t("tabWorkflows") }
}

/** The Workflows section of Setup for one instance: the connected block reads the workflows in the browser. */
export const AgentWorkflowsPage = (props: AgentWorkflowsPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    return <AgentWorkflowsPageBase props={{ module: props.module, installationId: props.installationId }} />
}
