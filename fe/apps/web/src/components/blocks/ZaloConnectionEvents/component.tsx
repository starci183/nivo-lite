import { SlotView } from "@nivo-lite/agent-sdk/client"
import {
    CONNECTION_EVENTS_PLACEHOLDER,
    ConnectionEventsCard,
    type ConnectionEventLine,
} from "@/components/composites/ConnectionEventsCard"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The words, the read and the retry of the live rail of a Zalo OA connection. */
export interface ZaloConnectionEventsBaseProps {
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

/** Draws the live rail of a Zalo OA connection: what NIVO last saw of each part of the OA, newest read every few seconds. */
export const ZaloConnectionEventsBase = (props: ZaloConnectionEventsBaseProps) => (
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
