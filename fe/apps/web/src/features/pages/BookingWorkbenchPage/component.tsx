import { BookingWorkbench } from "@/components/blocks/BookingWorkbench"

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
/** Places the sole booking world owner from already resolved server route atoms. */
export const BookingWorkbenchPageBase = (props: BookingWorkbenchPageBaseProps) => <BookingWorkbench {...props.props} />
