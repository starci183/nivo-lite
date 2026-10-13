import { RouteError } from "@/components/blocks/RouteError"

/** The words and the retry of the overview failure view. */
interface OverviewErrorPageBaseProps {
    readonly props: {
        readonly title: string
        readonly homeLabel: string
        readonly message: string
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** The overview keeps its heading when its data fails, with one alert and a retry. The overview is the home page, so its trail is just itself. */
export const OverviewErrorPageBase = (props: OverviewErrorPageBaseProps) => (
    <RouteError
        crumbs={[{ id: "home", label: props.props.homeLabel }]}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
