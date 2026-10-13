import { AgentChat } from "@/components/blocks/AgentChat"

/** STATE-8: the agent chat itself, with no data yet - the same frame, composer and labels, the agent's name, list and thread as skeletons. */
export const AgentChatLoadingPage = () => (
    <AgentChat agentId={undefined} initialTab="test" initialConversationId={null} welcome={false} />
)
