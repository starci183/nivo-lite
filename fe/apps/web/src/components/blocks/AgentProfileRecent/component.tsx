import { ListRegion } from "@/components/composites/ListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"
import { SlotView } from "@/components/composites/SlotView"
import type { ProfileRegionBaseProps } from "@/modules/types"

/** Props for {@link AgentProfileRecentBase}: the card copy and its lines as a slot. */
export type AgentProfileRecentBaseProps = ProfileRegionBaseProps<ListRegionProps["rows"]>

/** Draws the latest work of the agent: the subject, the customer and where it stands. */
export const AgentProfileRecentBase = (props: AgentProfileRecentBaseProps) => (
    <SlotView {...props.props.read} onRetry={props.on.retry}>
        {(rows, isSkeleton) => (
            <ListRegion label={props.props.label} rows={rows} footer={props.props.footer} isSkeleton={isSkeleton} />
        )}
    </SlotView>
)
