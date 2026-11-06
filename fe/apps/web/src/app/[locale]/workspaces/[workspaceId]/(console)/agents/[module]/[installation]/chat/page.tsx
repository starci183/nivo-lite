import type { ReactElement } from "react"
import { AgentChatTabPage } from "@/features/pages/AgentChatTabPage"

/** The document title of the chat tab. */
export { agentChatTabMetadata as generateMetadata } from "@/features/pages/AgentChatTabPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The chat slot of one agent instance: the viewer's direct room with the agent. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, installation } = await props.params
    return <AgentChatTabPage module={module} installationId={installation} />
}

export default Page
