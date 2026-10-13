import { notFound } from "next/navigation"
import { AgentChat } from "@/features/agent-chat"
import { getAgent } from "@/lib/queries"
import { readFoundingMember } from "@/modules/db/promo/read-founding-member"

type AgentChatPageProps = {
    params: Promise<{ agentId: string }>
    searchParams: Promise<{ tab?: string; c?: string; welcome?: string }>
}

/** Agent chat: owner test conversation and the simulated customer channel (`?tab=customer`). */
const AgentChatPage = async (props: AgentChatPageProps) => {
    const { agentId } = await props.params
    const { tab, c, welcome } = await props.searchParams
    const agent = await getAgent(agentId)
    if (!agent) notFound()
    const founding = welcome === "1" && agent.module === "chatbot" ? await readFoundingMember() : null
    const showWelcome = founding !== null && founding.kind === "ok" && founding.value
    return (
        <AgentChat
            agent={{
                id: agent.id,
                module: agent.module,
                name: agent.name,
                handle: agent.handle,
                role: agent.role,
                isActive: agent.status === "active",
                hasCustomerChannel: agent.module === "chatbot",
            }}
            initialTab={tab === "customer" ? "customer" : "test"}
            initialConversationId={c ?? null}
            showWelcome={showWelcome}
        />
    )
}

export default AgentChatPage

/** OpenClaw writes the text (setup chat, Office replies, classification), so these screens may wait longer than the platform default. */
export const maxDuration = 60
