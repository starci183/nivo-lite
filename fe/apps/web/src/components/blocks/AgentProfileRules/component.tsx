import { ListRegion } from "@/components/composites/ListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"
import { SlotView } from "@/components/composites/SlotView"
import type { ProfileRegionBaseProps } from "@/modules/types"

/** Props for {@link AgentProfileRulesBase}: the card copy and its lines as a slot. */
export type AgentProfileRulesBaseProps = ProfileRegionBaseProps<ListRegionProps["rows"]>

/** Draws the rules that apply to the agent: read-only, one line each with its mode. */
export const AgentProfileRulesBase = (props: AgentProfileRulesBaseProps) => (
    <SlotView {...props.props.read} onRetry={props.on.retry}>
        {(rows, isSkeleton) => (
            <ListRegion label={props.props.label} rows={rows} footer={props.props.footer} isSkeleton={isSkeleton} />
        )}
    </SlotView>
)
