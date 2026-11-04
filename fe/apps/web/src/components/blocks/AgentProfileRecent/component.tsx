import { ProfileListRegion } from "@/components/frames/ProfileListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"
import type { ProfileRegionBaseProps } from "@/modules/types"

/** Props for {@link AgentProfileRecentBase}: the card copy and its lines as a slot. */
export type AgentProfileRecentBaseProps = ProfileRegionBaseProps<ListRegionProps["rows"]>

/** Draws the latest work of the agent: the subject, the customer and where it stands. */
export const AgentProfileRecentBase = (props: AgentProfileRecentBaseProps) => <ProfileListRegion {...props} />
