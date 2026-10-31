import { CONNECTION_LINES_PLACEHOLDER, ConnectionLines } from "@/components/composites/ConnectionLines"
import { SlotView } from "@/components/composites/SlotView"
import type { ConnectionLineView, DataSlot, SlotLabels } from "@/modules/types"

/** Copy and slot of the check list. */
export interface TelegramConnectionChecksBaseProps {
    readonly props: {
        readonly title: string
        readonly lines: DataSlot<ReadonlyArray<ConnectionLineView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the check list of the third step: each part of the connection with its verdict and the line that says how to fix it. */
export const TelegramConnectionChecksBase = (props: TelegramConnectionChecksBaseProps) => (
    <SlotView
        slot={props.props.lines}
        placeholder={CONNECTION_LINES_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(lines, isSkeleton) => <ConnectionLines label={props.props.title} isSkeleton={isSkeleton} lines={lines} />}
    </SlotView>
)
