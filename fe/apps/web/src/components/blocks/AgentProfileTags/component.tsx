import { ProfileListRegion } from "@/components/frames/ProfileListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"
import type { ProfileRegionBaseProps } from "@/modules/types"

/** Props for {@link AgentProfileTagsBase}: the card copy and its lines as a slot. */
export type AgentProfileTagsBaseProps = ProfileRegionBaseProps<ListRegionProps["rows"]>

/** Draws the agents this agent may pass work to, each with its mark and the AI chip. */
export const AgentProfileTagsBase = (props: AgentProfileTagsBaseProps) => <ProfileListRegion {...props} />
