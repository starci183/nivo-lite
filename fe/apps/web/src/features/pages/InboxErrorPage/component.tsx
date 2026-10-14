import { RouteError } from "@/components/blocks/RouteError"

/** Copy and retry the failed inbox route supplies. */
export interface InboxErrorPageBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the inbox trail and heading with one alert and a retry. */
export const InboxErrorPageBase = (props: InboxErrorPageBaseProps) => (
    <RouteError
        crumbs={props.props.crumbs}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
