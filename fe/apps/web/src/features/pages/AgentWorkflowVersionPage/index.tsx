import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { AgentWorkflowVersion } from "@/components/blocks/AgentWorkflowVersion"
import { isModuleKey } from "@/modules/catalog"

/** What the route hands the page. */
type AgentWorkflowVersionPageProps = {
    readonly module: string
    readonly installationId: string
    readonly workflowKey: string
    /** The number of the version, as the url carries it. */
    readonly version: string
}

/** The document title of the page of one version of a workflow. */
export const agentWorkflowVersionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentWorkflows")
    return { title: t("tabWorkflows") }
}

/** The page of one version of a workflow: the connected block reads it in the browser. */
export const AgentWorkflowVersionPage = (props: AgentWorkflowVersionPageProps) => {
    const number = Number(props.version)
    if (!isModuleKey(props.module) || !Number.isInteger(number) || number < 1) notFound()
    return <AgentWorkflowVersion installationId={props.installationId} workflowKey={props.workflowKey} number={number} />
}

/** The same version page while the route loads: the block reads the agent, the workflow and the version from the address. */
export const AgentWorkflowVersionLoadingPage = () => <AgentWorkflowVersion />
