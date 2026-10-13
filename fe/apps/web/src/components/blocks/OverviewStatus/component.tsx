import { Alert } from "@starci/grammar/common"

/** The words and the retry of the overview failure notice. */
interface OverviewStatusBaseProps {
    readonly props: {
        readonly title: string
        readonly message: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** One negative alert with a retry, shown above the empty regions when the dashboard could not be read. */
export const OverviewStatusBase = (props: OverviewStatusBaseProps) => (
    <Alert
        title={props.props.title}
        description={props.props.message}
        tone="negative"
        action={{ label: props.props.retryLabel, onAction: props.on.retry }}
    />
)
