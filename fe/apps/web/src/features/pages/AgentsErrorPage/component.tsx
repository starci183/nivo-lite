import type { BreadcrumbItem } from "@starci/grammar/common"
import { RouteError } from "@/components/blocks/RouteError"

/** The trail and heading a failed route of the agents area keeps, and its retry. */
export interface AgentsErrorPageBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws a failed route of the agents area: its own trail and heading stay real, the body is one Alert with the retry. */
export const AgentsErrorPageBase = (props: AgentsErrorPageBaseProps) => (
    <RouteError crumbs={props.props.crumbs} title={props.props.title} onRetry={props.on.retry} />
)
