import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { BookingDesk } from "@/components/blocks/BookingDesk"
import { BookingExceptions } from "@/components/blocks/BookingExceptions"
import { BookingPolicyForm } from "@/components/blocks/BookingPolicyForm"
import { BookingPublicPageForm } from "@/components/blocks/BookingPublicPageForm"
import { BookingResources } from "@/components/blocks/BookingResources"
import { BookingServices } from "@/components/blocks/BookingServices"
import { BookingStats } from "@/components/blocks/BookingStats"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { BookingWaitlist } from "@/components/blocks/BookingWaitlist"
import type { BookingBoard } from "@/modules/types"
import { SETUP_CLASS } from "./classNames"

/** Props for {@link BookingWorkbenchPageBase}. */
export interface BookingWorkbenchPageBaseProps {
    readonly props: {
        readonly board: BookingBoard
        readonly installationId: string
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
        readonly installationId: string
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
            installationId={p.installationId}
            initialTab={p.initialTab}
            figures={p.figures}
            tabs={[
                {
                    id: "calendar",
                    label: withCount(p.tabs.calendar, p.waitingRequests),
                    content: <BookingDesk mode="week" />,
                },
                {
                    id: "today",
                    label: p.tabs.today,
                    content: <BookingDesk mode="today" />,
                },
                {
                    id: "waitlist",
                    label: withCount(p.tabs.waitlist, p.waitingCount),
                    content: <BookingWaitlist timezone={board.timezone} items={board.waitlist} />,
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
                            <BookingServices services={board.services} />
                            <BookingResources board={board} />
                            <BookingExceptions board={board} />
                            <BookingPolicyForm settings={board.settings} />
                            <BookingPublicPageForm settings={board.settings} />
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
        installationId={props.props.installationId}
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
