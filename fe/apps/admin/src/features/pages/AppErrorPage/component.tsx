import { Alert, Page } from "@starci/grammar/common"

/** Props for the pure render-failure page. */
export type AppErrorPageBaseProps = {
    readonly props: { readonly title: string; readonly text: string; readonly retryLabel: string }
    readonly on: { readonly retry: () => void }
}

/** Draws a render failure: one negative alert with the segment retry. */
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
