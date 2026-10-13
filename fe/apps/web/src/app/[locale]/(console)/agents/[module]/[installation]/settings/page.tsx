import { AgentSettingsPage } from "@/features/pages/AgentSettingsPage"

/** The document title of the settings tab. */
export { agentSettingsMetadata as generateMetadata } from "@/features/pages/AgentSettingsPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The settings slot of one agent instance. */
const Page = async (props: PageProps) => {
    const { module, installation } = await props.params
    return <AgentSettingsPage module={module} installationId={installation} />
}

export default Page
