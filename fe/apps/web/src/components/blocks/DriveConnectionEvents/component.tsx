import { SlotView } from "@nivo-lite/agent-sdk/client"
import { CONNECTION_EVENTS_PLACEHOLDER, ConnectionEventsCard } from "@/components/composites/ConnectionEventsCard"
import type { ConnectionEventLine } from "@/components/composites/ConnectionEventsCard"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The words, the read and the retry of the live rail of the Google Drive connection. */
export interface DriveConnectionEventsBaseProps {
    readonly props: {
        readonly title: string
        readonly liveLabel: string
        readonly emptyMessage: string
        readonly emptyHint: string
        /** The next step of the empty rail (choose folders); absent when there is none. */
        readonly emptyActionLabel?: string
        /** `neutral` while the band shows a primary of its own, so the page has one filled button. */
        readonly emptyActionIntent: "commit" | "neutral"
        /** Drive is granted, so the progress is a live feed; until then the card shows no live mark. */
        readonly isLive: boolean
        readonly lines: DataSlot<ReadonlyArray<ConnectionEventLine>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void; readonly emptyAction: () => void }
}

/** The rail's words and commands with the lines it draws. */
interface EventsCardProps extends DriveConnectionEventsBaseProps {
    readonly lines: ReadonlyArray<ConnectionEventLine>
    readonly isLoading: boolean
}

const EventsCard = (props: EventsCardProps) => (
    <ConnectionEventsCard
        title={props.props.title}
        liveLabel={props.props.liveLabel}
        isLive={props.props.isLive}
        emptyGlyph="document"
        lines={props.lines}
        emptyMessage={props.props.emptyMessage}
        emptyHint={props.props.emptyHint}
        {...(props.props.emptyActionLabel === undefined
            ? {}
            : {
                  emptyAction: {
                      label: props.props.emptyActionLabel,
                      run: props.on.emptyAction,
                      intent: props.props.emptyActionIntent,
                  },
              })}
        isLoading={props.isLoading}
    />
)

/**
 * Draws the live rail of the Google Drive connection: the files being read and where each stands, newest first. With none (Drive
 * off, or nothing read yet) the card itself says so and offers the next step, instead of the slot's plain empty line.
 */
export const DriveConnectionEventsBase = (props: DriveConnectionEventsBaseProps) =>
    "isEmpty" in props.props.lines ? (
        <EventsCard {...props} lines={[]} isLoading={false} />
    ) : (
        <SlotView
            slot={props.props.lines}
            placeholder={CONNECTION_EVENTS_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(lines, isLoading) => <EventsCard {...props} lines={lines} isLoading={isLoading} />}
        />
    )
