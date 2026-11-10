import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionRowBody } from "@/components/frames/ConnectionRowBody"
import type { RowCommandSet } from "@/components/frames/ConnectionRowBody"
import type { DataSlot, RowView, SlotLabels } from "@/modules/types"

/** The read, the placeholder and the commands of the content of a connection without a page of its own. */
export interface ConnectionOpenContentBaseProps {
    readonly props: {
        readonly slot: DataSlot<RowView>
        /** The view drawn while the read waits: same shape, no words. */
        readonly placeholder: RowView
        readonly slotLabels: SlotLabels
    }
    readonly on: RowCommandSet & { readonly retry: () => void }
}

/**
 * Draws what the connection's row says beyond its name: the alerts, the notes, the SMTP panel, the keys and the
 * last note. The two destructive questions belong to the band, whose menu opens them.
 */
export const ConnectionOpenContentBase = (props: ConnectionOpenContentBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(view) => <ConnectionRowBody view={view} on={props.on} withoutQuestions />}
    />
)
