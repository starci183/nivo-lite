import { AgentWorkPage } from "@/features/pages/AgentWorkPage"

/** The document title of the work tab. */
export { agentWorkMetadata as generateMetadata } from "@/features/pages/AgentWorkPage"

type PageProps = { readonly params: Promise<{ module: string; installation: string }> }

/** The work slot of one agent instance. */
const Page = async (props: PageProps) => {
    const { module, installation } = await props.params
    return <AgentWorkPage module={module} installationId={installation} />
}

export default Page
