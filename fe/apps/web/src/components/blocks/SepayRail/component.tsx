import { SlotView } from "@nivo-lite/agent-sdk/client"
import { CONNECTION_EVENTS_PLACEHOLDER, ConnectionEventsCard } from "@/components/composites/ConnectionEventsCard"
import type { ConnectionEventLine } from "@/components/composites/ConnectionEventsCard"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The words, the read and the retry of the live webhook events of a SePay connection. */
export interface SepayRailBaseProps {
    readonly props: {
        readonly title: string
        readonly liveLabel: string
        readonly emptyMessage: string
        readonly emptyHint: string
        readonly lines: DataSlot<ReadonlyArray<ConnectionEventLine>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the live events of a SePay connection: the webhook deliveries newest first, each with how the door answered it. */
export const SepayRailBase = (props: SepayRailBaseProps) => (
    <SlotView
        slot={props.props.lines}
        placeholder={CONNECTION_EVENTS_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(lines, isLoading) => (
            <ConnectionEventsCard
                title={props.props.title}
                liveLabel={props.props.liveLabel}
                lines={lines}
                emptyMessage={props.props.emptyMessage}
                emptyHint={props.props.emptyHint}
                isLoading={isLoading}
            />
        )}
    />
)
