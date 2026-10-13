import { RouteError } from "@/components/blocks/RouteError"

/** Copy and retry the failed admin route supplies. */
export interface AdminHealthErrorPageBaseProps {
    readonly props: {
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the failed route's heading with one alert and a retry. */
export const AdminHealthErrorPageBase = (props: AdminHealthErrorPageBaseProps) => (
    <RouteError
        crumbs={[{ id: "here", label: props.props.title }]}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
