import { AgentChatPage } from "@/features/pages/AgentChatPage"

export { agentChatMetadata as generateMetadata } from "@/features/pages/AgentChatPage"

interface PageProps {
    params: Promise<{ agentId: string }>
    searchParams: Promise<{ tab?: string; c?: string; welcome?: string }>
}

/** Agent chat: owner test conversation and the simulated customer channel (`?tab=customer`). */
const Page = async (props: PageProps) => {
    const { agentId } = await props.params
    const { tab, c, welcome } = await props.searchParams
    return <AgentChatPage agentId={agentId} tab={tab} conversationId={c} welcome={welcome} />
}

export default Page
