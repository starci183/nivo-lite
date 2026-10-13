import { RouteError } from "@/components/blocks/RouteError"
import { APP_ROUTES } from "@/modules/routes"

/** Copy and retry the failed team route supplies. */
export interface TeamErrorPageBaseProps {
    readonly props: {
        readonly crumbHome: string
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the team page's trail and heading with one alert and a retry. */
export const TeamErrorPageBase = (props: TeamErrorPageBaseProps) => (
    <RouteError
        crumbs={[
            { id: "home", label: props.props.crumbHome, href: APP_ROUTES.dashboard },
            { id: "team", label: props.props.title },
        ]}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
