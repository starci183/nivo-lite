import { AgentRecordRedirectPage } from "@/features/pages/AgentRecordRedirectPage"

/** The document title of an old agent url. */
export { agentRecordRedirectMetadata as generateMetadata } from "@/features/pages/AgentRecordRedirectPage"

type PageProps = { readonly params: Promise<{ agentId: string }> }

/** Moved: an agent's setup lives in its instance (/agents/<module>/<installationId>). The agent chat pages below keep working. */
const Page = async ({ params }: PageProps) => <AgentRecordRedirectPage agentId={(await params).agentId} />

export default Page
