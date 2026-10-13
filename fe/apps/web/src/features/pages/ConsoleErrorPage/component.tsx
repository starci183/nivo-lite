import { RouteError } from "@/components/blocks/RouteError"

/** The trail label of a failed console route and its retry. */
export interface ConsoleErrorPageBaseProps {
    readonly props: { readonly crumbHome: string }
    readonly on: { readonly retry: () => void }
}

/** Draws the last-resort console failure: the shell trail and heading, one Alert and a retry. */
export const ConsoleErrorPageBase = (props: ConsoleErrorPageBaseProps) => (
    <RouteError
        crumbs={[{ id: "home", label: props.props.crumbHome }]}
        title={props.props.crumbHome}
        onRetry={props.on.retry}
    />
)
