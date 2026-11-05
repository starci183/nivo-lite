import { PaneFailure } from "@/components/composites/PaneFailure"

/** The words of the failure of the Telegram connection page. */
export interface TelegramConnectionErrorPageBaseProps {
    readonly props: {
        readonly label: string
        readonly title: string
        readonly description: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** The Telegram connection page keeps the Connections frame and its list when its data fails: one notice in its pane, with a retry. */
export const TelegramConnectionErrorPageBase = (props: TelegramConnectionErrorPageBaseProps) => (
    <PaneFailure
        label={props.props.label}
        title={props.props.title}
        description={props.props.description}
        retryLabel={props.props.retryLabel}
        onRetry={props.on.retry}
    />
)
