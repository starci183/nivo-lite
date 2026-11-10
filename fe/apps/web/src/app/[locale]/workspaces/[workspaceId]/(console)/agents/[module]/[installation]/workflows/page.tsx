import type { ReactElement } from "react"
import { AgentWorkflowsPage } from "@/features/pages/AgentWorkflowsPage"

/** The document title of the Workflows tab. */
export { agentWorkflowsMetadata as generateMetadata } from "@/features/pages/AgentWorkflowsPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The Workflows tab of one agent instance: its workflows as a table. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, installation } = await props.params
    return <AgentWorkflowsPage module={module} installationId={installation} />
}

export default Page
