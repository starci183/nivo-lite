import type { ReactElement } from "react"
import { AgentWorkflowTemplatePreviewPage } from "@/features/pages/AgentWorkflowTemplatePreviewPage"

/** The document title of the preview of a newer template version. */
export { agentWorkflowTemplatePreviewMetadata as generateMetadata } from "@/features/pages/AgentWorkflowTemplatePreviewPage"

type PageProps = {
    readonly params: Promise<{ module: string; installation: string; workflowKey: string; templateVersion: string }>
}

/** What a newer template version would change in a workflow: its own route, opened from the notice of the workflow's page. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, installation, workflowKey, templateVersion } = await props.params
    return (
        <AgentWorkflowTemplatePreviewPage
            module={module}
            installationId={installation}
            workflowKey={workflowKey}
            templateVersion={templateVersion}
        />
    )
}

export default Page
