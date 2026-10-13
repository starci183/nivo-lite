import { RouteError } from "@/components/blocks/RouteError"

/** The trail, heading and retry of the failed Connections route. */
export interface ConnectionsErrorPageBaseProps {
    readonly props: {
        readonly title: string
        readonly crumbHome: string
        readonly homeHref: string
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** STATE-8: Connections keep their trail and heading when the data fails, with one Alert and a retry. */
export const ConnectionsErrorPageBase = (props: ConnectionsErrorPageBaseProps) => (
    <RouteError
        crumbs={[
            { id: "home", label: props.props.crumbHome, href: props.props.homeHref },
            { id: "connections", label: props.props.title },
        ]}
        title={props.props.title}
        onRetry={props.on.retry}
    />
)
