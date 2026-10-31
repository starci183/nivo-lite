import { RouteError } from "@/components/blocks/RouteError"

/** The trail, the heading and the words of the failure. */
export interface ZaloConnectionErrorPageBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        readonly title: string
        readonly message: string
    }
    readonly on: { readonly retry: () => void }
}

/** The Zalo OA page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const ZaloConnectionErrorPageBase = (props: ZaloConnectionErrorPageBaseProps) => (
    <RouteError
        crumbs={props.props.crumbs}
        title={props.props.title}
        message={props.props.message}
        onRetry={props.on.retry}
    />
)
