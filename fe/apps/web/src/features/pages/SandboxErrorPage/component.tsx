import { Alert, Page, type PageHeaderBreadcrumbs } from "@starci/grammar/common"

/** Copy and retry the failed sandbox route supplies. */
export interface SandboxErrorPageBaseProps {
    readonly props: {
        readonly breadcrumbs: PageHeaderBreadcrumbs
        readonly title: string
        readonly alertTitle: string
        readonly message: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the sandbox page whose route failed: the header stays, the body is one alert that says what happened, with the retry. */
export const SandboxErrorPageBase = (props: SandboxErrorPageBaseProps) => (
    <Page header={{ breadcrumbs: props.props.breadcrumbs, title: props.props.title }} measure="product">
        <Alert
            tone="negative"
            title={props.props.alertTitle}
            description={props.props.message}
            action={{ label: props.props.retryLabel, onAction: props.on.retry }}
        />
    </Page>
)
