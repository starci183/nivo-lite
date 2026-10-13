import { RouteError } from "@/components/blocks/RouteError"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** Copy the failed Second Brain route supplies. */
export interface BrainErrorPageBaseProps {
    readonly props: {
        readonly crumbHome: string
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the Second Brain trail and heading with one alert and a retry. */
export const BrainErrorPageBase = (props: BrainErrorPageBaseProps) => (
    <RouteError
        crumbs={[
            { id: "home", label: props.props.crumbHome, href: CONSOLE_ROUTES.dashboard },
            { id: "brain", label: props.props.title },
        ]}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
