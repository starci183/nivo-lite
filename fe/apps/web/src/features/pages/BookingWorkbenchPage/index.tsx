import { notFound } from "next/navigation"
import { BookingWorkbench } from "@/components/blocks/BookingWorkbench"

/** What the agent workbench route hands the booking workbench. */
interface BookingWorkbenchPageProps {
    /** `?tab=` of the route; anything unknown opens the first tab. */
    readonly tab?: string | null
    /** The Booking agent instance the workbench opens for; one per branch. */
    readonly installationId?: string
}

/** /agents/booking/workbench: the calendar of a week, today, the waiting list, the statistics and the setup of the shop. */
export const BookingWorkbenchPage = (props: BookingWorkbenchPageProps) => {
    if (props.installationId === undefined) notFound()
    return <BookingWorkbench installationId={props.installationId} initialTab={props.tab ?? null} />
}
