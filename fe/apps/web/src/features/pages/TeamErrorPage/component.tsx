import { Alert, Page } from "@starci/grammar/common"

/** Copy and retry the failed team route supplies. */
export interface TeamErrorPageBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly tabsLabel: string
        readonly membersTab: string
        readonly membersHref: string
        readonly permissionsTab: string
        readonly permissionsHref: string
        /** Which of the two team pages failed. */
        readonly selected: "members" | "permissions"
        readonly alertTitle: string
        readonly message: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws a team page whose data failed: the header and tabs stay, the body is one alert that says what happened, with the retry. */
export const TeamErrorPageBase = (props: TeamErrorPageBaseProps) => (
    <Page
        header={{
            title: props.props.title,
            description: props.props.description,
            tabs: {
                label: props.props.tabsLabel,
                selectedKey: props.props.selected,
                labelVisibility: "always",
                items: [
                    { id: "members", label: props.props.membersTab, href: props.props.membersHref },
                    { id: "permissions", label: props.props.permissionsTab, href: props.props.permissionsHref },
                ],
            },
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
