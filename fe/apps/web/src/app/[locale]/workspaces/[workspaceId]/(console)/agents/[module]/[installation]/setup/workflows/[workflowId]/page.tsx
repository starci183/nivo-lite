import type { ReactElement } from "react"
import { AgentWorkflowsMovedPage } from "@/features/pages/AgentWorkflowsMovedPage"

/** The document title of the old address. */
export { agentWorkflowsMovedMetadata as generateMetadata } from "@/features/pages/AgentWorkflowsMovedPage"

type PageProps = {
    readonly params: Promise<{ workspaceId: string; module: string; installation: string; workflowId: string }>
}

/** The old page of one workflow under Setup: it forwards to the page of that workflow in the Workflows tab. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, module, installation, workflowId } = await props.params
    return (
        <AgentWorkflowsMovedPage
            workspaceId={workspaceId}
            module={module}
            installationId={installation}
            workflow={workflowId}
        />
    )
}

export default Page
