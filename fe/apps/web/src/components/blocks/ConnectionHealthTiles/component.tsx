import { ConnectionFactsPane, type ConnectionFactsPaneProps } from "@/components/frames/ConnectionFactsPane"

/** Copy and slot of the health tiles of a provider page. */
export interface ConnectionHealthTilesBaseProps {
    readonly props: Omit<ConnectionFactsPaneProps, "onRetry">
    readonly on: { readonly retry: () => void }
}

/** Draws the three health tiles of a provider page (DISCIPLINE-2: figure, label, meta line) as a band of the page's main pane. */
export const ConnectionHealthTilesBase = (props: ConnectionHealthTilesBaseProps) => (
    <ConnectionFactsPane
        label={props.props.label}
        facts={props.props.facts}
        slotLabels={props.props.slotLabels}
        onRetry={props.on.retry}
    />
)
