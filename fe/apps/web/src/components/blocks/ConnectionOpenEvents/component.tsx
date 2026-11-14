import { ConnectionEventsCard, type ConnectionEventLine } from "@/components/composites/ConnectionEventsCard"

/** The words and the lines of the live card of a connection without a page of its own. */
export interface ConnectionOpenEventsBaseProps {
    readonly props: {
        readonly title: string
        readonly liveLabel: string
        readonly emptyMessage: string
        readonly emptyHint: string
        readonly lines: ReadonlyArray<ConnectionEventLine>
        readonly isLoading: boolean
    }
}

/** Draws what the connection last reported; before any event, what will show here. */
export const ConnectionOpenEventsBase = (props: ConnectionOpenEventsBaseProps) => (
    <ConnectionEventsCard {...props.props} />
)
