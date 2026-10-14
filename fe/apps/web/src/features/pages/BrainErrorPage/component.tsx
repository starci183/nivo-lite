import { RouteError } from "@/components/blocks/RouteError"

/** Copy the failed Second Brain route supplies. */
export interface BrainErrorPageBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the Second Brain trail and heading with one alert and a retry. */
export const BrainErrorPageBase = (props: BrainErrorPageBaseProps) => (
    <RouteError
        crumbs={props.props.crumbs}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
