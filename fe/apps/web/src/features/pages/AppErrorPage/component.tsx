import { Alert, Page } from "@starci/grammar/common"

/** Props for the pure error page. */
export type AppErrorPageBaseProps = {
    readonly props: { readonly title: string; readonly text: string; readonly retryLabel: string }
    readonly on: { readonly retry: () => void }
}

/** Draws a recoverable failure: one negative Alert with the safe retry, as the body of a page with no header band. */
export const AppErrorPageBase = (props: AppErrorPageBaseProps) => (
    <Page measure="reading">
        <Alert
            tone="negative"
            title={props.props.title}
            description={props.props.text}
            action={{ label: props.props.retryLabel, onAction: props.on.retry }}
        />
    </Page>
)
