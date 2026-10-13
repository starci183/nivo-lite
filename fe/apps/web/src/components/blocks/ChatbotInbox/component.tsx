import { ChatbotConversationList } from "@/components/composites/ChatbotConversationList"
import type { ChatbotConversationListProps } from "@/components/composites/ChatbotConversationList"
import { ChatbotInboxPanel } from "@/components/composites/ChatbotInboxPanel"
import { ChatbotSidePanel } from "@/components/composites/ChatbotSidePanel"
import type { ChatbotSidePanelProps } from "@/components/composites/ChatbotSidePanel"
import { ChatbotThreadView } from "@/components/composites/ChatbotThreadView"
import type { ChatbotThreadViewProps } from "@/components/composites/ChatbotThreadView"
import { PanelPending } from "@/components/composites/PanelPending"
import type { PanelPendingProps } from "@/components/composites/PanelPending"

type ListWords = Omit<ChatbotConversationListProps, "onQuery" | "onFilter" | "onSelect">
type ThreadWords = Omit<ChatbotThreadViewProps, "onBack" | "onToggleInfo" | "onDraft" | "onSend">
type SideWords = Omit<ChatbotSidePanelProps, "onClose" | "onToggleHandling" | "onEscalationDraft" | "onAnswer">

/** The resolved words, rows and panes of the inbox. */
interface ChatbotInboxView {
    readonly title: string
    readonly actionFailedTitle: string
    readonly actionError: string | null
    readonly pane: "list" | "thread"
    readonly hasSelection: boolean
    readonly pickTitle: string
    readonly pickBody: string
    readonly list: ListWords
    readonly thread: ThreadWords
    readonly sideLabel: string
    readonly isInfoOpen: boolean
    readonly side: SideWords
}

/** Props for {@link ChatbotInboxBase}. */
export interface ChatbotInboxBaseProps {
    readonly props: {
        /** The inbox once its snapshot is read; null while it is not. */
        readonly inbox: ChatbotInboxView | null
        readonly pending: PanelPendingProps
    }
    readonly on: {
        readonly query: (query: string) => void
        readonly filter: (filter: string) => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly toggleInfo: () => void
        readonly draft: (draft: string) => void
        readonly send: () => void
        readonly toggleHandling: () => void
        readonly escalationDraft: (draft: string) => void
        readonly answer: (send: boolean) => void
    }
}

/** Draws the inbox of one Chatbot instance: the conversation list, the open thread and the customer side panel. */
export const ChatbotInboxBase = (props: ChatbotInboxBaseProps) => {
    const inbox = props.props.inbox
    const on = props.on
    if (inbox === null) return <PanelPending {...props.props.pending} />
    return (
        <ChatbotInboxPanel
            title={inbox.title}
            actionFailedTitle={inbox.actionFailedTitle}
            actionError={inbox.actionError}
            pane={inbox.pane}
            hasSelection={inbox.hasSelection}
            pickTitle={inbox.pickTitle}
            pickBody={inbox.pickBody}
            sideLabel={inbox.sideLabel}
            isInfoOpen={inbox.isInfoOpen}
            list={
                <ChatbotConversationList {...inbox.list} onQuery={on.query} onFilter={on.filter} onSelect={on.select} />
            }
            thread={
                <ChatbotThreadView
                    {...inbox.thread}
                    onBack={on.back}
                    onToggleInfo={on.toggleInfo}
                    onDraft={on.draft}
                    onSend={on.send}
                />
            }
            side={
                <ChatbotSidePanel
                    {...inbox.side}
                    onClose={on.toggleInfo}
                    onToggleHandling={on.toggleHandling}
                    onEscalationDraft={on.escalationDraft}
                    onAnswer={on.answer}
                />
            }
        />
    )
}
