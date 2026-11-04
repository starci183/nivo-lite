import { PaneFailure } from "@/components/composites/PaneFailure"

/** The words of the failure of the Sepay connection page. */
export interface SepayConnectionErrorPageBaseProps {
    readonly props: {
        readonly label: string
        readonly title: string
        readonly description: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** The Sepay connection page keeps the Connections frame and its list when its data fails: one notice in its pane, with a retry. */
export const SepayConnectionErrorPageBase = (props: SepayConnectionErrorPageBaseProps) => (
    <PaneFailure
        label={props.props.label}
        title={props.props.title}
        description={props.props.description}
        retryLabel={props.props.retryLabel}
        onRetry={props.on.retry}
    />
)
