import { RouteError } from "@/components/blocks/RouteError"

/** Copy and trail the failed knowledge route supplies. */
export interface KnowledgeErrorPageBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws a knowledge page trail and heading with one alert and a retry. */
export const KnowledgeErrorPageBase = (props: KnowledgeErrorPageBaseProps) => (
    <RouteError
        crumbs={props.props.crumbs}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
