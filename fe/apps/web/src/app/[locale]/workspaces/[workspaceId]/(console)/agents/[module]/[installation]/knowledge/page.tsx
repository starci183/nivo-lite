import type { ReactElement } from "react"
import { AgentKnowledgePage } from "@/features/pages/AgentKnowledgePage"

/** The document title of the knowledge tab. */
export { agentKnowledgeMetadata as generateMetadata } from "@/features/pages/AgentKnowledgePage"

type PageProps = { readonly params: Promise<{ workspaceId: string; module: string; installation: string }> }

/** The knowledge slot of one agent instance: what the agent sees of the Second Brain, by layer. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, module, installation } = await props.params
    return <AgentKnowledgePage workspaceId={workspaceId} module={module} installationId={installation} />
}

export default Page
