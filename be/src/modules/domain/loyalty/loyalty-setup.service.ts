import { Injectable } from "@nestjs/common"
import { LoyaltyCustomersService, customerBirthday } from "@modules/domain/loyalty-customers"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyProgram } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService, rewardPresetEdits } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import type {
    CustomerUpdateResult,
    RewardDeleteResult,
    RewardPresetsResult,
    RewardRef,
    SaveProgramParams,
    SaveRewardParams,
    UpdateCustomerParams,
} from "./loyalty-setup.contracts"
import type { WorkspaceRef } from "./loyalty.contracts"

const MANAGER_ROLES = ["owner", "manager"] as const

@Injectable()
/** The programme setup, reward catalogue and customer profile changes, authorised by workspace membership. */
export class LoyaltySetupService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly programs: LoyaltyProgramsService,
        private readonly rewardsCatalog: LoyaltyRewardsService,
        private readonly customers: LoyaltyCustomersService,
    ) {}

    /** Saves programme settings, allocating the public slug when the owner saves for the first time. */
    async saveProgram(userId: string, params: SaveProgramParams): Promise<LoyaltyProgram> {
        await this.members.require(userId, params.workspaceId, MANAGER_ROLES)
        const program = await this.programs.save(params.workspaceId, params)
        if (program === null) throw new LoyaltyError({ code: LoyaltyErrorCode.ProgramNotSaved })
        return program
    }

    /** Saves a new or existing reward after proving the owner's role and checking its required fields. */
    async saveReward(userId: string, params: SaveRewardParams): Promise<LoyaltyReward> {
        await this.members.require(userId, params.workspaceId, MANAGER_ROLES)
        if (params.name.trim() === "") throw new LoyaltyError({ code: LoyaltyErrorCode.RewardNameRequired })
        if (!Number.isFinite(params.pointsCost) || Math.round(params.pointsCost) < 1) {
            throw new LoyaltyError({ code: LoyaltyErrorCode.RewardPointsInvalid })
        }
        const reward = await this.rewardsCatalog.save(params.workspaceId, params)
        if (reward === null) {
            throw new LoyaltyError({
                code: params.id === undefined ? LoyaltyErrorCode.RewardNotSaved : LoyaltyErrorCode.RewardNotFound,
            })
        }
        return reward
    }

    /** Removes an active catalogue entry, pausing used rewards to preserve their redemption history. */
    async deleteReward(userId: string, params: RewardRef): Promise<RewardDeleteResult> {
        await this.members.require(userId, params.workspaceId, MANAGER_ROLES)
        const removed = await this.rewardsCatalog.remove(params.workspaceId, params.rewardId)
        return { deleted: removed !== "missing" }
    }

    /** Adds only missing starter rewards; repeated requests preserve every saved entry. */
    async addRewardPresets(userId: string, params: WorkspaceRef): Promise<RewardPresetsResult> {
        await this.members.require(userId, params.workspaceId, MANAGER_ROLES)
        return { added: await this.rewardsCatalog.addPresets(params.workspaceId, rewardPresetEdits(this.messages)) }
    }

    /** Saves the owner's profile edits; a supplied null birthday clears it. */
    async updateCustomer(userId: string, params: UpdateCustomerParams): Promise<CustomerUpdateResult> {
        await this.members.require(userId, params.workspaceId, MANAGER_ROLES)
        if (params.birthday != null) {
            const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(this.clock.now())
            if (
                customerBirthday(params.birthday) === null ||
                params.birthday < "1900-01-01" ||
                params.birthday > today
            ) {
                throw new LoyaltyError({ code: LoyaltyErrorCode.BirthdayInvalid })
            }
        }
        const updated = await this.customers.updateProfile(params.workspaceId, params.customerId, params)
        if (!updated) throw new LoyaltyError({ code: LoyaltyErrorCode.MemberNotFound })
        return { updated }
    }
}
