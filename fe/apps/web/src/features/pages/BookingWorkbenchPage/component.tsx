import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { BookingDesk } from "@/components/blocks/BookingDesk"
import { BookingExceptions } from "@/components/blocks/BookingExceptions"
import { BookingPolicyForm } from "@/components/blocks/BookingPolicyForm"
import { BookingPublicPageForm } from "@/components/blocks/BookingPublicPageForm"
import { BookingResources } from "@/components/blocks/BookingResources"
import { BookingServices } from "@/components/blocks/BookingServices"
import { BookingStats } from "@/components/blocks/BookingStats"
import { BookingWaitlist } from "@/components/blocks/BookingWaitlist"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { BookingBoard } from "@/modules/types"
import { SETUP_CLASS } from "./classNames"

/** Props for {@link BookingWorkbenchPageBase}. */
export interface BookingWorkbenchPageBaseProps {
    readonly props: {
        readonly workspaceId: string
        readonly board: BookingBoard
        readonly dashboard: AgentDashboardData
        readonly initialTab: string | null
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly tabs: {
            readonly calendar: string
            readonly today: string
            readonly waitlist: string
            readonly stats: string
            readonly setup: string
        }
        readonly waitingCount: number
        readonly waitingRequests: number
    }
}

/** Props for {@link BookingWorkbenchFailedBase}. */
export interface BookingWorkbenchFailedBaseProps {
    readonly props: {
        readonly dashboard: AgentDashboardData
        readonly tabLabel: string
        readonly loadFailed: { readonly title: string; readonly body: string }
    }
}

const withCount = (label: string, count: number): string => (count > 0 ? `${label} (${count})` : label)

/** Draws the booking workbench: the agent dashboard frame around the calendar, today, the waiting list, the statistics and the setup. */
export const BookingWorkbenchPageBase = (props: BookingWorkbenchPageBaseProps) => {
    const p = props.props
    const { board } = p
    return (
        <AgentDashboardFrame
            module="booking"
            data={p.dashboard}
            initialTab={p.initialTab}
            figures={p.figures}
            tabs={[
                {
                    id: "calendar",
                    label: withCount(p.tabs.calendar, p.waitingRequests),
                    content: <BookingDesk workspaceId={p.workspaceId} initial={board} mode="week" />,
                },
                {
                    id: "today",
                    label: p.tabs.today,
                    content: <BookingDesk key={board.nowMs} workspaceId={p.workspaceId} initial={board} mode="today" />,
                },
                {
                    id: "waitlist",
                    label: withCount(p.tabs.waitlist, p.waitingCount),
                    content: (
                        <BookingWaitlist workspaceId={p.workspaceId} timezone={board.timezone} items={board.waitlist} />
                    ),
                },
                {
                    id: "stats",
                    label: p.tabs.stats,
                    content: <BookingStats stats={board.stats} from={board.from} to={board.to} />,
                },
                {
                    id: "setup",
                    label: p.tabs.setup,
                    content: (
                        <div className={SETUP_CLASS}>
                            <BookingServices workspaceId={p.workspaceId} services={board.services} />
                            <BookingResources workspaceId={p.workspaceId} board={board} />
                            <BookingExceptions workspaceId={p.workspaceId} board={board} />
                            <BookingPolicyForm workspaceId={p.workspaceId} settings={board.settings} />
                            <BookingPublicPageForm workspaceId={p.workspaceId} settings={board.settings} />
                        </div>
                    ),
                },
            ]}
        />
    )
}

/** Draws the booking workbench when the calendar could not be read: the frame and one tab that says so. */
export const BookingWorkbenchFailedBase = (props: BookingWorkbenchFailedBaseProps) => (
    <AgentDashboardFrame
        module="booking"
        data={props.props.dashboard}
        figures={[]}
        figuresFailed
        tabs={[
            {
                id: "calendar",
                label: props.props.tabLabel,
                content: (
                    <SurfaceCard ariaLabel={props.props.loadFailed.title}>
                        <EmptyNotice message={props.props.loadFailed.title} description={props.props.loadFailed.body} />
                    </SurfaceCard>
                ),
            },
        ]}
    />
)
