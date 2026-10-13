import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { ChatbotInbox } from "@/components/blocks/ChatbotInbox"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import { KnowledgeGapsCard } from "@/features/brain/gaps"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { KnowledgeGap } from "@/lib/brain/gaps-shared"
import type { ChatbotOverview, ChatbotThread } from "@/modules/types"

/** The knowledge gaps owners and managers can fill in place, with the agents they can be answered for. */
interface ChatbotWorkbenchGaps {
    readonly gaps: ReadonlyArray<KnowledgeGap>
    readonly lenses: ReadonlyArray<{
        readonly module: string
        readonly name: string
        readonly audience: "customer" | "internal"
    }>
    /** The workspace's name: the subject of an answer when the agent could not guess one. */
    readonly business: string
}

/** The workbench data, or null when the inbox could not be read, with the words and the frame's common regions. */
interface ChatbotWorkbenchBaseProps {
    readonly props: {
        readonly overview: ChatbotOverview | null
        readonly thread: ChatbotThread | null
        readonly selectedId: string | null
        readonly userName: string
        /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
        readonly dashboard: AgentDashboardData
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly tabLabel: string
        readonly loadFailedTitle: string
        /** Owner or manager only: the gaps card takes the place of the frame's own gaps block. */
        readonly gaps: ChatbotWorkbenchGaps | null
    }
}

/** The Chatbot workbench: the agent dashboard frame around the inbox (conversation list, thread and customer panel). */
export const ChatbotWorkbenchBase = (props: ChatbotWorkbenchBaseProps) => {
    const { overview } = props.props
    const gaps =
        props.props.gaps === null ? null : (
            <KnowledgeGapsCard
                gaps={props.props.gaps.gaps}
                lenses={props.props.gaps.lenses}
                business={props.props.gaps.business}
            />
        )
    if (overview === null) {
        return (
            <AgentDashboardFrame
                module="chatbot"
                data={props.props.dashboard}
                gaps={gaps}
                figures={[]}
                figuresFailed
                tabs={[
                    {
                        id: "inbox",
                        label: props.props.tabLabel,
                        content: (
                            <SurfaceCard ariaLabel={props.props.loadFailedTitle}>
                                <EmptyNotice message={props.props.loadFailedTitle} />
                            </SurfaceCard>
                        ),
                    },
                ]}
            />
        )
    }
    return (
        <AgentDashboardFrame
            module="chatbot"
            data={props.props.dashboard}
            gaps={gaps}
            figures={props.props.figures}
            tabs={[
                {
                    id: "inbox",
                    label: props.props.tabLabel,
                    content: (
                        <ChatbotInbox
                            overview={overview}
                            thread={props.props.thread}
                            selectedId={props.props.selectedId}
                            userName={props.props.userName}
                        />
                    ),
                },
            ]}
        />
    )
}
