import { Alert, Page, type PageHeaderContent } from "@starci/grammar/common"

/** Copy and retry the failed personal route supplies. */
export interface AccountErrorPageBaseProps {
    readonly props: {
        /** The page's own header with its personal tabs: it stays real when the data fails. */
        readonly header: PageHeaderContent
        readonly measure: "reading" | "product"
        readonly alertTitle: string
        readonly message: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws a personal page whose data failed: the header and tabs stay, the body is one alert that says what happened, with the retry. */
export const AccountErrorPageBase = (props: AccountErrorPageBaseProps) => (
    <Page header={props.props.header} measure={props.props.measure}>
        <Alert
            tone="negative"
            title={props.props.alertTitle}
            description={props.props.message}
            action={{ label: props.props.retryLabel, onAction: props.on.retry }}
        />
    </Page>
)
