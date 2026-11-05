import { LoyaltyProgramSettingsView } from "@nivo-lite/blocks-core/client/loyalty"
import type { LoyaltyProgramSettingsViewProps } from "@nivo-lite/blocks-core/client/loyalty"

/** Resolved read models and atomic commands of the loyalty programme form. */
export type LoyaltyProgramSettingsBaseProps = LoyaltyProgramSettingsViewProps

/** Draws the whole loyalty programme in one form from resolved props and commands. */
export const LoyaltyProgramSettingsBase = (props: LoyaltyProgramSettingsBaseProps) => (
    <LoyaltyProgramSettingsView props={props.props} on={props.on} />
)
