import type { ReactElement } from "react"
import { AgentWorkflowsMovedPage } from "@/features/pages/AgentWorkflowsMovedPage"

/** The document title of the old address. */
export { agentWorkflowsMovedMetadata as generateMetadata } from "@/features/pages/AgentWorkflowsMovedPage"

type PageProps = { readonly params: Promise<{ workspaceId: string; module: string; installation: string }> }

/** The old workflows section of Setup: it forwards to the Workflows tab of the agent. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, module, installation } = await props.params
    return <AgentWorkflowsMovedPage workspaceId={workspaceId} module={module} installationId={installation} />
}

export default Page
