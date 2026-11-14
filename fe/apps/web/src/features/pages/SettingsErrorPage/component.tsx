import { RouteError } from "@/components/blocks/RouteError"

/** Copy and retry the failed settings route supplies. */
export interface SettingsErrorPageBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the settings page's trail and heading with one alert and a retry. */
export const SettingsErrorPageBase = (props: SettingsErrorPageBaseProps) => (
    <RouteError
        crumbs={props.props.crumbs}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
