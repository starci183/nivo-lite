import type { ReactElement } from "react"
import { AgentGeneralPage } from "@/features/pages/AgentGeneralPage"

/** The document title of the general section of setup. */
export { agentGeneralMetadata as generateMetadata } from "@/features/pages/AgentGeneralPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The "Chung" section of Setup for one agent instance: its name, owner, pause and removal. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { module, installation } = await props.params
    return <AgentGeneralPage module={module} installationId={installation} />
}

export default Page
