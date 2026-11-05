import { LoyaltyWorkbenchView } from "@nivo-lite/blocks-core/client/loyalty"
import type { LoyaltyWorkbenchViewProps } from "@nivo-lite/blocks-core/client/loyalty"

/** Resolved atoms of the Loyalty world: the shape, the read models and the actions. */
export type LoyaltyWorkbenchBaseProps = LoyaltyWorkbenchViewProps

/** Draws the Loyalty world from resolved atom models, slots and actions only. */
export const LoyaltyWorkbenchBase = (props: LoyaltyWorkbenchBaseProps) => <LoyaltyWorkbenchView {...props} />
