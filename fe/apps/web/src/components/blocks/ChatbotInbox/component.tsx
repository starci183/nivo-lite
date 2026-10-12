import { Alert, EmptyNotice, FillViewport, SurfaceCard } from "@starci/grammar/common"
import {
    ChatbotConversationList,
    type ChatbotConversationListProps,
} from "@/components/composites/ChatbotConversationList"
import { ChatbotSidePanel, type ChatbotSidePanelProps } from "@/components/composites/ChatbotSidePanel"
import { ChatbotThreadView, type ChatbotThreadViewProps } from "@/components/composites/ChatbotThreadView"
import {
    CENTER_CLASS_NAME,
    INBOX_CLASS_NAME,
    LIST_PANE_OPEN_CLASS_NAME,
    LIST_PANE_WIDE_ONLY_CLASS_NAME,
    SIDE_PANE_DOCKED_ONLY_CLASS_NAME,
    SIDE_PANE_OPEN_CLASS_NAME,
    THREAD_PANE_OPEN_CLASS_NAME,
    THREAD_PANE_WIDE_ONLY_CLASS_NAME,
    WORKBENCH_CLASS_NAME,
} from "./classNames"

type ListWords = Omit<ChatbotConversationListProps, "onQuery" | "onFilter" | "onSelect">
type ThreadWords = Omit<ChatbotThreadViewProps, "onBack" | "onToggleInfo" | "onDraft" | "onSend">
type SideWords = Omit<ChatbotSidePanelProps, "onClose" | "onToggleHandling" | "onEscalationDraft" | "onAnswer">

/** The resolved words, rows and panes of the inbox. */
interface ChatbotInboxBaseProps {
    readonly props: {
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

/** The Chatbot inbox: the conversation list, the open thread and the customer pane inside one joined card. */
export const ChatbotInboxBase = (props: ChatbotInboxBaseProps) => {
    const { on } = props
    const isListOpen = props.props.pane === "list"
    return (
        <div className={WORKBENCH_CLASS_NAME}>
            {props.props.actionError === null ? null : (
                <Alert tone="negative" title={props.props.actionFailedTitle} description={props.props.actionError} />
            )}
            <FillViewport minHeight="md" bottomInset="page">
                <SurfaceCard ariaLabel={props.props.title} composition="joined" height="fill">
                    <div className={INBOX_CLASS_NAME}>
                        <div className={isListOpen ? LIST_PANE_OPEN_CLASS_NAME : LIST_PANE_WIDE_ONLY_CLASS_NAME}>
                            <ChatbotConversationList
                                {...props.props.list}
                                onQuery={on.query}
                                onFilter={on.filter}
                                onSelect={on.select}
                            />
                        </div>
                        <div className={isListOpen ? THREAD_PANE_WIDE_ONLY_CLASS_NAME : THREAD_PANE_OPEN_CLASS_NAME}>
                            {props.props.hasSelection ? (
                                <ChatbotThreadView
                                    {...props.props.thread}
                                    onBack={on.back}
                                    onToggleInfo={on.toggleInfo}
                                    onDraft={on.draft}
                                    onSend={on.send}
                                />
                            ) : (
                                <div className={CENTER_CLASS_NAME}>
                                    <EmptyNotice message={props.props.pickTitle} description={props.props.pickBody} />
                                </div>
                            )}
                        </div>
                        {props.props.hasSelection ? (
                            <aside
                                className={
                                    props.props.isInfoOpen
                                        ? SIDE_PANE_OPEN_CLASS_NAME
                                        : SIDE_PANE_DOCKED_ONLY_CLASS_NAME
                                }
                                aria-label={props.props.sideLabel}
                            >
                                <ChatbotSidePanel
                                    {...props.props.side}
                                    onClose={on.toggleInfo}
                                    onToggleHandling={on.toggleHandling}
                                    onEscalationDraft={on.escalationDraft}
                                    onAnswer={on.answer}
                                />
                            </aside>
                        ) : null}
                    </div>
                </SurfaceCard>
            </FillViewport>
        </div>
    )
}
