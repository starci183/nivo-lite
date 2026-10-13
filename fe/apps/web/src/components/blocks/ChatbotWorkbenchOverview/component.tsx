import { Alert } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { ChatbotConversationList } from "@/components/composites/ChatbotConversationList"
import type { ChatbotConversationListProps } from "@/components/composites/ChatbotConversationList"
import { ChatbotInboxPanel } from "@/components/composites/ChatbotInboxPanel"
import { ChatbotSidePanel } from "@/components/composites/ChatbotSidePanel"
import type { ChatbotSidePanelProps } from "@/components/composites/ChatbotSidePanel"
import { ChatbotThreadView } from "@/components/composites/ChatbotThreadView"
import type { ChatbotThreadViewProps } from "@/components/composites/ChatbotThreadView"
import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { ChatbotGapsView } from "@/hooks/chatbot"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"

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

/** The frame, the unanswered-questions card and the inbox of one Chatbot instance, with every word resolved. */
interface ChatbotWorkbenchOverviewBaseProps {
    readonly props: {
        readonly dashboard: AgentDashboardData | undefined
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly isLoading: boolean
        readonly figuresFailed: boolean
        readonly error: string | undefined
        readonly errorTitle: string
        readonly reloadLabel: string
        readonly title: string
        readonly gaps: ChatbotGapsView | null
        readonly inbox: ChatbotInboxView | null
    }
    readonly on: {
        readonly reload: () => void
        readonly reloadGaps: () => void
        readonly dismissGap: (id: string) => void
        readonly inboxQuery: (query: string) => void
        readonly inboxFilter: (filter: string) => void
        readonly inboxSelect: (id: string) => void
        readonly inboxBack: () => void
        readonly inboxToggleInfo: () => void
        readonly inboxDraft: (draft: string) => void
        readonly inboxSend: () => void
        readonly inboxToggleHandling: () => void
        readonly inboxEscalationDraft: (draft: string) => void
        readonly inboxAnswer: (send: boolean) => void
    }
}

/** The rows of the unanswered-questions card, with the brain link and the dismiss action of each. */
const gapRowsOf = (view: ChatbotGapsView, dismissGap: (id: string) => void): KnowledgeRowsProps["rows"] =>
    view.rows.map((row) => ({
        id: row.id,
        title: row.title,
        lines: [row.line],
        badges: row.badges,
        actions: [
            { id: "answer", label: row.answerLabel, href: row.answerHref },
            { id: "dismiss", label: row.dismissLabel, variant: "ghost" as const, onPress: () => dismissGap(row.id) },
        ],
    }))

/** The workbench frame, with a retry that revalidates its browser data. */
export const ChatbotWorkbenchOverviewBase = (props: ChatbotWorkbenchOverviewBaseProps) => {
    const { props: p, on } = props
    const gaps = p.gaps
    const inbox = p.inbox
    return (
        <>
            {p.error === undefined ? null : (
                <Alert
                    tone="negative"
                    title={p.errorTitle}
                    description={p.error}
                    action={{ label: p.reloadLabel, onAction: on.reload }}
                />
            )}
            <AgentDashboardFrame
                module="chatbot"
                data={p.dashboard}
                figures={p.figures}
                isLoading={p.isLoading}
                figuresFailed={p.figuresFailed}
                gaps={
                    gaps === null ? null : (
                        <KnowledgeRows
                            section={{
                                id: gaps.id,
                                title: gaps.title,
                                description: gaps.description,
                                failTitle: gaps.failTitle,
                                error: gaps.errorText ?? undefined,
                                action: gaps.hasError
                                    ? { id: "reload", label: gaps.reloadLabel, onPress: on.reloadGaps }
                                    : undefined,
                            }}
                            label={gaps.title}
                            isLoading={gaps.isLoading}
                            isPending={gaps.isPending}
                            emptyTitle={gaps.emptyTitle}
                            rows={gapRowsOf(gaps, on.dismissGap)}
                        />
                    )
                }
                tabs={[
                    {
                        id: "inbox",
                        label: p.title,
                        content:
                            inbox === null ? null : (
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
                                        <ChatbotConversationList
                                            {...inbox.list}
                                            onQuery={on.inboxQuery}
                                            onFilter={on.inboxFilter}
                                            onSelect={on.inboxSelect}
                                        />
                                    }
                                    thread={
                                        <ChatbotThreadView
                                            {...inbox.thread}
                                            onBack={on.inboxBack}
                                            onToggleInfo={on.inboxToggleInfo}
                                            onDraft={on.inboxDraft}
                                            onSend={on.inboxSend}
                                        />
                                    }
                                    side={
                                        <ChatbotSidePanel
                                            {...inbox.side}
                                            onClose={on.inboxToggleInfo}
                                            onToggleHandling={on.inboxToggleHandling}
                                            onEscalationDraft={on.inboxEscalationDraft}
                                            onAnswer={on.inboxAnswer}
                                        />
                                    }
                                />
                            ),
                    },
                ]}
            />
        </>
    )
}
