import type { ReactElement } from "react"
import { AgentLandingPage } from "@/features/pages/AgentLandingPage"

/** The document title of the landing. */
export { agentLandingMetadata as generateMetadata } from "@/features/pages/AgentLandingPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The landing of one agent instance: it opens Setup for an agent that is not set up and the workbench otherwise. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, installation } = await props.params
    return <AgentLandingPage module={module} installationId={installation} />
}

export default Page
