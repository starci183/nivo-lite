import { AgentIdRedirectPage } from "@/features/pages/AgentIdRedirectPage"

export { agentIdRedirectMetadata as generateMetadata } from "@/features/pages/AgentIdRedirectPage"

/** What the route passes through: the agent id of the old url. */
interface PageProps {
    readonly params: Promise<{ readonly agentId: string }>
}

/** Moved: an agent's setup lives in its instance (/agents/<module>/<installationId>). The agent chat pages below keep working. */
const Page = async (props: PageProps) => <AgentIdRedirectPage agentId={(await props.params).agentId} />

export default Page
