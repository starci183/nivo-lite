import { ConnectionFactsPane } from "@/components/frames/ConnectionFactsPane"
import type { ConnectionFactsPaneProps } from "@/components/frames/ConnectionFactsPane"

/** Copy and slot of the health tiles. */
export interface ZaloConnectionFactsBaseProps {
    readonly props: Omit<ConnectionFactsPaneProps, "onRetry">
    readonly on: { readonly retry: () => void }
}

/** Draws the three health tiles of a Zalo OA connection (DISCIPLINE-2: figure, label, meta line) as a band of the page's main pane. */
export const ZaloConnectionFactsBase = (props: ZaloConnectionFactsBaseProps) => (
    <ConnectionFactsPane
        label={props.props.label}
        facts={props.props.facts}
        slotLabels={props.props.slotLabels}
        onRetry={props.on.retry}
    />
)
