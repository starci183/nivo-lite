import type { ReactElement } from "react"
import { AgentGraphTabPage } from "@/features/pages/AgentGraphTabPage"

/** The document title of the graph tab. */
export { agentGraphTabMetadata as generateMetadata } from "@/features/pages/AgentGraphTabPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The graph slot of one agent instance: its workflows and the calls between them. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, installation } = await props.params
    return <AgentGraphTabPage module={module} installationId={installation} />
}

export default Page
