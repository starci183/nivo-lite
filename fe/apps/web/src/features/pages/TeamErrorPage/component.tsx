import { Alert, Page, type PageHeaderBreadcrumbs } from "@starci/grammar/common"

/** Copy and retry the failed team route supplies. */
export interface TeamErrorPageBaseProps {
    readonly props: {
        readonly breadcrumbs: PageHeaderBreadcrumbs
        readonly title: string
        readonly description: string
        readonly alertTitle: string
        readonly message: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the team page whose data failed: the header stays, the body is one alert that says what happened, with the retry. */
export const TeamErrorPageBase = (props: TeamErrorPageBaseProps) => (
    <Page
        header={{
            breadcrumbs: props.props.breadcrumbs,
            title: props.props.title,
            description: props.props.description,
        }}
        measure="product"
    >
        <Alert
            tone="negative"
            title={props.props.alertTitle}
            description={props.props.message}
            action={{ label: props.props.retryLabel, onAction: props.on.retry }}
        />
    </Page>
)
