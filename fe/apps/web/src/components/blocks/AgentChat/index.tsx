"use client"

import { useAgentChat } from "@/hooks/agentChat"
import { navigation } from "@/modules/i18n"
import { PromoWelcomeBanner } from "@/components/blocks/PromoWelcomeBanner"
import { AgentChatBase } from "./component"
import type { AgentChatTab } from "./component"

export type { AgentChatTab } from "./component"

/** The agent the chat talks to: plain data handed over by the server page. */
interface AgentChatAgent {
    readonly id: string
    readonly module?: string
    readonly name: string
    readonly handle: string
    readonly role: string
    readonly isActive: boolean
    readonly hasCustomerChannel: boolean
}

/** Props for {@link AgentChat}. */
interface AgentChatProps {
    /** Null while the agent loads (isLoading). */
    readonly agent: AgentChatAgent | null
    /** The workspace whose conversations the page follows through Realtime. */
    readonly workspaceId: string | null
    readonly initialTab: AgentChatTab
    readonly initialConversationId: string | null
    /** True only for a Founding 50 member arriving with ?welcome=1. */
    readonly showWelcome?: boolean
    /** STATE-8: the same chat while the agent loads - the frame, labels and composer real; the agent's name, the list and the thread skeletons. */
    readonly isLoading?: boolean
}

const NOOP = (): void => undefined

/** Connected agent chat: loads conversations, sends messages, follows Realtime inserts. Without an agent it is the loading frame. */
export const AgentChat = (props: AgentChatProps) =>
    props.agent === null ? (
        <AgentChatBase
            props={{
                agentName: "",
                agentHandle: "",
                agentRole: "",
                isAgentActive: false,
                hasCustomerChannel: false,
                tab: "test",
                conversations: [],
                messages: [],
                hasSelection: false,
                isLoadingList: true,
                isSending: false,
                isStarting: false,
                draft: "",
                visitorName: "",
                error: null,
                leadId: null,
                isTakenOver: false,
                isTakingOver: false,
                isLoading: true,
            }}
            on={{
                toggleTakeover: NOOP,
                back: NOOP,
                tab: NOOP,
                draft: NOOP,
                visitorName: NOOP,
                send: NOOP,
                start: NOOP,
                select: NOOP,
                openLead: NOOP,
            }}
        />
    ) : (
        <ConnectedAgentChat {...props} agent={props.agent} />
    )

/** The chat of a loaded agent: the hook owns the state, the base draws it. */
const ConnectedAgentChat = (props: AgentChatProps & { readonly agent: AgentChatAgent }) => {
    const { agent } = props
    const router = navigation.useRouter()
    const chat = useAgentChat({
        agentId: agent.id,
        workspaceId: props.workspaceId,
        hasCustomerChannel: agent.hasCustomerChannel,
        initialTab: props.initialTab,
        initialConversationId: props.initialConversationId,
    })
    return (
        <AgentChatBase
            props={{
                ...(props.showWelcome === true ? { banner: <PromoWelcomeBanner agentId={agent.id} /> } : {}),
                ...(agent.module === undefined ? {} : { agentModule: agent.module }),
                setupHref: `/modules/${agent.id}`,
                agentName: agent.name,
                agentHandle: agent.handle,
                agentRole: agent.role,
                isAgentActive: agent.isActive,
                hasCustomerChannel: agent.hasCustomerChannel,
                tab: chat.tab,
                conversations: chat.rows,
                messages: chat.thread,
                hasSelection: chat.hasSelection,
                isLoadingList: chat.isLoadingList,
                isSending: chat.isSending,
                isStarting: chat.isStarting,
                draft: chat.draft,
                visitorName: chat.visitorName,
                error: chat.error,
                leadId: chat.leadId,
                isTakenOver: chat.isTakenOver,
                isTakingOver: chat.isTakingOver,
            }}
            on={{
                toggleTakeover: chat.toggleTakeover,
                back: () => router.push("/modules"),
                tab: chat.changeTab,
                draft: chat.setDraft,
                visitorName: chat.setVisitorName,
                send: chat.send,
                start: chat.start,
                select: chat.select,
                openLead: (id) => router.push(`/leads/${id}`),
            }}
        />
    )
}
