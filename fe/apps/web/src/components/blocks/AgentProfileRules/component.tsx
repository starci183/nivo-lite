import { ProfileListRegion } from "@/components/frames/ProfileListRegion"
import type { ListRegionProps } from "@/components/composites/ListRegion"
import type { ProfileRegionBaseProps } from "@/modules/types"

/** Props for {@link AgentProfileRulesBase}: the card copy and its lines as a slot. */
export type AgentProfileRulesBaseProps = ProfileRegionBaseProps<ListRegionProps["rows"]>

/** Draws the rules that apply to the agent: read-only, one line each with its mode. */
export const AgentProfileRulesBase = (props: AgentProfileRulesBaseProps) => <ProfileListRegion {...props} />
