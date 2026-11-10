import type { ReactElement } from "react"
import { AgentConnectionsPage } from "@/features/pages/AgentConnectionsPage"

/** The document title of the connections tab. */
export { agentConnectionsMetadata as generateMetadata } from "@/features/pages/AgentConnectionsPage"

type PageProps = { readonly params: Promise<{ workspaceId: string; module: string; installation: string }> }

/** The connections slot of one agent instance: the accounts it may use, with the purpose and the level of each. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, module, installation } = await props.params
    return <AgentConnectionsPage workspaceId={workspaceId} module={module} installationId={installation} />
}

export default Page
