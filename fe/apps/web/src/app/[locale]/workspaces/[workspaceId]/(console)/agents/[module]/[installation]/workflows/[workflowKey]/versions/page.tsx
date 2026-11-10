import type { ReactElement } from "react"
import { AgentWorkflowDetailPage } from "@/features/pages/AgentWorkflowDetailPage"

/** The document title of the page of one workflow. */
export { agentWorkflowDetailMetadata as generateMetadata } from "@/features/pages/AgentWorkflowDetailPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string; workflowKey: string }> }

/** The versions part of the page of one workflow: its own route, so the sub-tab row of the frame can link to it. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, installation, workflowKey } = await props.params
    return <AgentWorkflowDetailPage module={module} installationId={installation} workflowKey={workflowKey} part="versions" />
}

export default Page
