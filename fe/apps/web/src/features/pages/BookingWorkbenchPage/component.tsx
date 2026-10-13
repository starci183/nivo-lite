import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { BookingDesk } from "@/components/blocks/BookingDesk"
import { BookingExceptions } from "@/components/blocks/BookingExceptions"
import { BookingFigures } from "@/components/blocks/BookingFigures"
import { BookingPolicyForm } from "@/components/blocks/BookingPolicyForm"
import { BookingPublicPageForm } from "@/components/blocks/BookingPublicPageForm"
import { BookingResources } from "@/components/blocks/BookingResources"
import { BookingServices } from "@/components/blocks/BookingServices"
import { BookingStats } from "@/components/blocks/BookingStats"
import { BookingWaitlist } from "@/components/blocks/BookingWaitlist"
import { SETUP_CLASS } from "./classNames"

/** Props for {@link BookingWorkbenchPageBase}. */
export interface BookingWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string
        readonly initialTab: string | null
        readonly tabs: {
            readonly calendar: string
            readonly today: string
            readonly waitlist: string
            readonly stats: string
            readonly setup: string
        }
    }
}

/** Draws the booking workbench: the agent dashboard frame around the calendar, today, the waiting list, the statistics and the setup. */
export const BookingWorkbenchPageBase = (props: BookingWorkbenchPageBaseProps) => {
    const p = props.props
    return (
        <AgentDashboardFrame
            module="booking"
            installationId={p.installationId}
            initialTab={p.initialTab}
            ribbon={<BookingFigures />}
            tabs={[
                {
                    id: "calendar",
                    label: p.tabs.calendar,
                    content: <BookingDesk mode="week" />,
                },
                { id: "today", label: p.tabs.today, content: <BookingDesk mode="today" /> },
                { id: "waitlist", label: p.tabs.waitlist, content: <BookingWaitlist /> },
                { id: "stats", label: p.tabs.stats, content: <BookingStats /> },
                {
                    id: "setup",
                    label: p.tabs.setup,
                    content: (
                        <div className={SETUP_CLASS}>
                            <BookingServices />
                            <BookingResources />
                            <BookingExceptions />
                            <BookingPolicyForm />
                            <BookingPublicPageForm />
                        </div>
                    ),
                },
            ]}
        />
    )
}
