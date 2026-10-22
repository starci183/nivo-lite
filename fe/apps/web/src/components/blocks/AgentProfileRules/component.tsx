import { ListRegion } from "@/components/composites/ListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"

/** Props for {@link AgentProfileRulesBase}. */
export interface AgentProfileRulesBaseProps {
    readonly props: Omit<ListRegionProps, "onRetry">
    readonly on: { readonly retry: () => void }
}

/** Draws the rules that apply to the agent: read-only, one line each with its mode. */
export const AgentProfileRulesBase = (props: AgentProfileRulesBaseProps) => (
    <ListRegion {...props.props} onRetry={props.on.retry} />
)
