import type { ReactElement } from "react"
import { AgentRunPage } from "@/features/pages/AgentRunPage"

/** The document title of the page of a run. */
export { agentRunMetadata as generateMetadata } from "@/features/pages/AgentRunPage"

type PageProps = {
    readonly params: Promise<{ module: string; installation: string; runId: string }>
}

/** One run of one agent instance. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, installation, runId } = await props.params
    return <AgentRunPage module={module} installationId={installation} runId={runId} />
}

export default Page
