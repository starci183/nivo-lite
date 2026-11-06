import { RouteError } from "@/components/blocks/RouteError"

/** Copy and retry the failed team chat route supplies. */
export interface TeamChatErrorPageBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the team chat trail and heading with one alert and a retry. */
export const TeamChatErrorPageBase = (props: TeamChatErrorPageBaseProps) => (
    <RouteError
        crumbs={props.props.crumbs}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
