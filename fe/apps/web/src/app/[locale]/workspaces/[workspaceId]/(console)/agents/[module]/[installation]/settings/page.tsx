import type { ReactElement } from "react"
import { AgentSettingsPage } from "@/features/pages/AgentSettingsPage"

/** The document title of the old settings address. */
export { agentSettingsMetadata as generateMetadata } from "@/features/pages/AgentSettingsPage"

type PageProps = { readonly params: Promise<{ workspaceId: string; module: string; installation: string }> }

/** The old settings slot of one agent instance: it forwards to the "Chung" section of Setup. */
const Page = async (props: PageProps): Promise<ReactElement> => {
    const { workspaceId, module, installation } = await props.params
    return <AgentSettingsPage workspaceId={workspaceId} module={module} installationId={installation} />
}

export default Page
