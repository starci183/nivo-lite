import { AgentChat } from "@/features/agent-chat";

/** STATE-8: the agent chat itself, with no data yet - the same frame, composer and labels, the agent's name, list and thread as skeletons. */
const AgentChatLoading = () => <AgentChat isLoading agent={null} initialTab="test" initialConversationId={null} />;

export default AgentChatLoading;
