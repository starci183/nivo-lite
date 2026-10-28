import { ListRegion } from "@/components/composites/ListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"
import { SlotView } from "@/components/composites/SlotView"
import type { ProfileRegionBaseProps } from "@/modules/types"

/** Props for {@link AgentProfileTagsBase}: the card copy and its lines as a slot. */
export type AgentProfileTagsBaseProps = ProfileRegionBaseProps<ListRegionProps["rows"]>

/** Draws the agents this agent may pass work to, each with its mark and the AI chip. */
export const AgentProfileTagsBase = (props: AgentProfileTagsBaseProps) => (
    <SlotView {...props.props.read} onRetry={props.on.retry}>
        {(rows, isSkeleton) => (
            <ListRegion label={props.props.label} rows={rows} footer={props.props.footer} isSkeleton={isSkeleton} />
        )}
    </SlotView>
)
