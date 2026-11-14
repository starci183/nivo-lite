import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { AgentWorkflowTemplatePreview } from "@/components/blocks/AgentWorkflowTemplatePreview"
import { isModuleKey } from "@/modules/catalog"

/** What the route hands the page. */
type AgentWorkflowTemplatePreviewPageProps = {
    readonly module: string
    readonly installationId: string
    readonly workflowKey: string
    /** The template version, as the url carries it. */
    readonly templateVersion: string
}

/** The document title of the preview of a newer template version. */
export const agentWorkflowTemplatePreviewMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentWorkflows")
    return { title: t("tabWorkflows") }
}

/** The page of what a newer template version would change in a workflow: the connected block reads it in the browser. */
export const AgentWorkflowTemplatePreviewPage = (props: AgentWorkflowTemplatePreviewPageProps) => {
    const version = Number(props.templateVersion)
    if (!isModuleKey(props.module) || !Number.isInteger(version) || version < 1) notFound()
    return (
        <AgentWorkflowTemplatePreview
            installationId={props.installationId}
            workflowKey={props.workflowKey}
            templateVersion={version}
        />
    )
}

/** The same page while the route loads: the block reads the agent, the workflow and the version from the address. */
export const AgentWorkflowTemplatePreviewLoadingPage = () => <AgentWorkflowTemplatePreview />
