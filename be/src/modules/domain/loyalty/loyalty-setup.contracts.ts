import type { CustomerPatch } from "@modules/domain/loyalty-customers"
import type { ProgramPatch } from "@modules/domain/loyalty-programs"
import type { RewardEdit } from "@modules/domain/loyalty-rewards"
import type { MemberRef, WorkspaceRef } from "./loyalty.contracts"

/** The programme fields saved for a workspace. */
export interface SaveProgramParams extends WorkspaceRef, ProgramPatch {}

/** The catalogue entry saved for a workspace. */
export interface SaveRewardParams extends WorkspaceRef, RewardEdit {}

/** A reward of a workspace. */
export interface RewardRef extends WorkspaceRef {
    /** The reward to remove. */
    readonly rewardId: string
}

/** The answer to a catalogue removal. */
export interface RewardDeleteResult {
    /** Whether the reward existed and was removed from the active catalogue; used rewards are paused. */
    readonly deleted: boolean
}

/** The answer to installing the starter catalogue. */
export interface RewardPresetsResult {
    /** The entries created; existing keys were preserved. */
    readonly added: number
}

/** The profile fields saved for one customer. */
export interface UpdateCustomerParams extends MemberRef, CustomerPatch {}

/** The answer to a customer profile update. */
export interface CustomerUpdateResult {
    /** Whether the customer's profile was saved. */
    readonly updated: boolean
}
