import type { LoyaltyCampaignView } from "@modules/domain/loyalty-campaigns"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import type { LoyaltyConfig, LoyaltyProgram } from "@modules/domain/loyalty-programs"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import type { LoyaltyOverview } from "./loyalty.contracts"

/** The programme and reward choices shown by the settings form, including defaults before first save. */
export interface LoyaltyProgramSettings {
    /** The saved programme, absent before first save. */
    readonly program: LoyaltyProgram | null
    /** The current rules or the starter defaults. */
    readonly config: LoyaltyConfig
    /** The active rewards offered for the birthday gift. */
    readonly rewards: ReadonlyArray<LoyaltyReward>
}

/** The complete loyalty workbench read. Pending decisions use the decisions feature. */
export interface LoyaltyBoard extends LoyaltyOverview {
    /** The saved programme, absent before first save. */
    readonly program: LoyaltyProgram | null
    /** The current rules or the starter defaults. */
    readonly config: LoyaltyConfig
    /** The customers and their ledger balances. */
    readonly members: ReadonlyArray<LoyaltyMember>
    /** The reward catalogue, including paused rewards. */
    readonly rewards: ReadonlyArray<LoyaltyReward>
    /** The newest campaigns. */
    readonly campaigns: ReadonlyArray<LoyaltyCampaignView>
    /** Whether the caller can edit the programme and catalogue. */
    readonly canManage: boolean
}
