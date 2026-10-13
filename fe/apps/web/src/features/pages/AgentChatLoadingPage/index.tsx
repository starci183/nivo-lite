import { AgentChatPageBase } from "../AgentChatPage/component"

/** STATE-8: the agent chat itself, with no data yet - the same frame, composer and labels, the agent's name, list and thread as skeletons. */
export const AgentChatLoadingPage = () => (
    <AgentChatPageBase
        props={{ agent: null, workspaceId: null, initialTab: "test", initialConversationId: null, showWelcome: false }}
    />
)
