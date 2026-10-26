import { Breadcrumbs } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"

/** Copy of the trail above an agent instance. */
export interface AgentInstanceCrumbsBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
    }
}

/** Draws the trail above the surface of an agent instance. */
export const AgentInstanceCrumbsBase = (props: AgentInstanceCrumbsBaseProps) => (
    <Breadcrumbs label={props.props.crumbLabel} items={props.props.crumbs} />
)
