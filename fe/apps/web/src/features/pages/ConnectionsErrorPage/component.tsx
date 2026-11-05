import { PaneFailure } from "@/components/composites/PaneFailure"

/** The words of the failure of the Connections overview. */
export interface ConnectionsErrorPageBaseProps {
    readonly props: {
        readonly label: string
        readonly title: string
        readonly description: string
        readonly retryLabel: string
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** The Connections overview keeps the frame and its list when its data fails: one notice in its pane, with a retry. */
export const ConnectionsErrorPageBase = (props: ConnectionsErrorPageBaseProps) => (
    <PaneFailure
        label={props.props.label}
        title={props.props.title}
        description={props.props.description}
        retryLabel={props.props.retryLabel}
        onRetry={props.on.retry}
    />
)
