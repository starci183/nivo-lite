import { ListRegion } from "@/components/composites/ListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"

/** Props for {@link AgentProfileRecentBase}. */
export interface AgentProfileRecentBaseProps {
    readonly props: Omit<ListRegionProps, "onRetry">
    readonly on: { readonly retry: () => void }
}

/** Draws the latest work of the agent: the subject, the customer and where it stands. */
export const AgentProfileRecentBase = (props: AgentProfileRecentBaseProps) => (
    <ListRegion {...props.props} onRetry={props.on.retry} />
)
