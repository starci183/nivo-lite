import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { AgentWorkflowDetail } from "@/components/blocks/AgentWorkflowDetail"
import { isModuleKey } from "@/modules/catalog"

/** What the route hands the page. */
type AgentWorkflowDetailPageProps = {
    readonly module: string
    readonly installationId: string
    readonly workflowKey: string
    /** The part of the page the route names: In and Out, the map, the versions or the runs. */
    readonly part: "io" | "map" | "versions" | "runs"
}

/** The document title of the page of one workflow. */
export const agentWorkflowDetailMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentWorkflows")
    return { title: t("tabWorkflows") }
}

/** The page of one workflow: the connected block reads it in the browser. */
export const AgentWorkflowDetailPage = (props: AgentWorkflowDetailPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    return <AgentWorkflowDetail module={props.module} installationId={props.installationId} workflowKey={props.workflowKey} part={props.part} />
}

/** What a loading route hands the workflow page: the part it opens on (a loading boundary knows no params). */
type AgentWorkflowDetailLoadingPageProps = {
    readonly part: AgentWorkflowDetailPageProps["part"]
}

/** The same workflow page while the route loads: the block reads the agent and the workflow from the address and draws its own skeletons. */
export const AgentWorkflowDetailLoadingPage = (props: AgentWorkflowDetailLoadingPageProps) => (
    <AgentWorkflowDetail part={props.part} />
)
