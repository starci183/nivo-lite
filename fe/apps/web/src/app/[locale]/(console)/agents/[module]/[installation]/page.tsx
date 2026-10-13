import { AgentSetupPage } from "@/features/pages/AgentSetupPage"

/** The document title of the setup tab. */
export { agentSetupMetadata as generateMetadata } from "@/features/pages/AgentSetupPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** OpenClaw writes the text of the setup chat, so this screen may wait longer than the platform default. */
export const maxDuration = 60

/** The setup slot of one agent instance: its private setup chat with NIVO. */
const Page = async (props: PageProps) => {
    const { module, installation } = await props.params
    return <AgentSetupPage module={module} installationId={installation} />
}

export default Page
