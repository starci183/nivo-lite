import { PaneFailure } from "@/components/composites/PaneFailure"

/** The words of the failure of the Zalo connection page. */
export interface ZaloConnectionErrorPageBaseProps {
    readonly props: {
        readonly label: string
        readonly title: string
        readonly description: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** The Zalo connection page keeps the Connections frame and its list when its data fails: one notice in its pane, with a retry. */
export const ZaloConnectionErrorPageBase = (props: ZaloConnectionErrorPageBaseProps) => (
    <PaneFailure
        label={props.props.label}
        title={props.props.title}
        description={props.props.description}
        retryLabel={props.props.retryLabel}
        onRetry={props.on.retry}
    />
)
