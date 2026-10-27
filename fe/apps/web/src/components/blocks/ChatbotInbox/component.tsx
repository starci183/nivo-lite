import {
    ChatbotConversationList,
    type ChatbotConversationListProps,
} from "@/components/composites/ChatbotConversationList"

import { ChatbotInboxPanel } from "@/components/composites/ChatbotInboxPanel"
import { ChatbotSidePanel, type ChatbotSidePanelProps } from "@/components/composites/ChatbotSidePanel"

import { ChatbotThreadView, type ChatbotThreadViewProps } from "@/components/composites/ChatbotThreadView"

import { SlotView } from "@/components/composites/SlotView"
import type { SlotPanelProps } from "@/modules/types"

type ListWords = Omit<ChatbotConversationListProps, "onQuery" | "onFilter" | "onSelect">
type ThreadWords = Omit<ChatbotThreadViewProps, "onBack" | "onToggleInfo" | "onDraft" | "onSend">
type SideWords = Omit<
    ChatbotSidePanelProps,
    "onClose" | "onToggleHandling" | "onEscalationDraft" | "onSendAnswer" | "onDeclineAnswer"
>

/** The resolved words, rows and panes of the inbox. */
export interface ChatbotInboxView {
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
    /** The placeholder is the inbox with no conversations: its words stay real while the panes draw as skeleton. */
    readonly props: SlotPanelProps<ChatbotInboxView>
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
        readonly sendAnswer: () => void
        readonly declineAnswer: () => void
        readonly reload: () => void
    }
}

/** Draws the inbox of one Chatbot instance: the conversation list, the open thread and the customer side panel. */
export const ChatbotInboxBase = (props: ChatbotInboxBaseProps) => {
    const { props: p, on } = props
    return (
        <SlotView slot={p.slot} placeholder={p.placeholder} labels={p.labels} onRetry={on.reload}>
            {(inbox, isSkeleton) => (
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
                    isSkeleton={isSkeleton}
                    list={
                        <ChatbotConversationList
                            {...inbox.list}
                            isSkeleton={isSkeleton}
                            onQuery={on.query}
                            onFilter={on.filter}
                            onSelect={on.select}
                        />
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
                            onSendAnswer={on.sendAnswer}
                            onDeclineAnswer={on.declineAnswer}
                        />
                    }
                />
            )}
        </SlotView>
    )
}
