import { ListRegion } from "@/components/composites/ListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"

/** Props for {@link AgentProfileTagsBase}. */
export interface AgentProfileTagsBaseProps {
    readonly props: Omit<ListRegionProps, "onRetry">
    readonly on: { readonly retry: () => void }
}

/** Draws the agents this agent may pass work to, each with its mark and the AI chip. */
export const AgentProfileTagsBase = (props: AgentProfileTagsBaseProps) => (
    <ListRegion {...props.props} onRetry={props.on.retry} />
)
