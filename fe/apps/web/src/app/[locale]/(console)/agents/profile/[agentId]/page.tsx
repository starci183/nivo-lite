import { AgentProfilePage } from "@/features/pages/AgentProfilePage"

/** The document title of this page. */
export { agentProfileMetadata as generateMetadata } from "@/features/pages/AgentProfilePage"

type PageProps = { readonly params: Promise<{ agentId: string }> }

/** The profile of one agent: who answers for it, who may give it work, whom it may tag, its rules and recent work. */
const Page = async (props: PageProps) => <AgentProfilePage agentId={(await props.params).agentId} />

export default Page
