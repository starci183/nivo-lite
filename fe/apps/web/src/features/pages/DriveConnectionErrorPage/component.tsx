import { PaneFailure } from "@/components/composites/PaneFailure"

/** The words of the failure of the Drive connection page. */
export interface DriveConnectionErrorPageBaseProps {
    readonly props: {
        readonly label: string
        readonly title: string
        readonly description: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** The Drive connection page keeps the Connections frame and its list when its data fails: one notice in its pane, with a retry. */
export const DriveConnectionErrorPageBase = (props: DriveConnectionErrorPageBaseProps) => (
    <PaneFailure
        label={props.props.label}
        title={props.props.title}
        description={props.props.description}
        retryLabel={props.props.retryLabel}
        onRetry={props.on.retry}
    />
)
