import { RouteError } from "@/components/blocks/RouteError"

/** Copy and retry the failed account route supplies. */
export interface AccountErrorPageBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the account page's trail and heading with one alert and a retry. */
export const AccountErrorPageBase = (props: AccountErrorPageBaseProps) => (
    <RouteError
        crumbs={props.props.crumbs}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
