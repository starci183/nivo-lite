import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LoyaltyReward, RewardMatch } from "./loyalty-rewards.contracts"
import {
    LOCK_REWARD,
    SELECT_ACTIVE_REWARDS,
    SELECT_REWARDS,
    SELECT_REWARD_BY_ID,
    SELECT_REWARD_BY_KEY,
    TAKE_STOCK,
} from "./persistence/loyalty-rewards.sql"
import { toReward } from "./persistence/loyalty-rewards.rows"
import type { RewardRow } from "./persistence/loyalty-rewards.rows"

@Injectable()
/** The reward catalogue of a workspace: read for customers and owners, and the stock taken when a reward is redeemed. */
export class LoyaltyRewardsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The catalogue in display order; only the rewards customers may redeem now when `onlyActive`. */
    async list(workspaceId: string, onlyActive: boolean): Promise<ReadonlyArray<LoyaltyReward>> {
        const rows = await this.entityManager.query<Array<RewardRow>>(
            onlyActive ? SELECT_ACTIVE_REWARDS : SELECT_REWARDS,
            [workspaceId],
        )
        return rows.map(toReward)
    }

    /** One reward by id, or null. */
    async byId(workspaceId: string, rewardId: string): Promise<RewardMatch> {
        const [row] = await this.entityManager.query<Array<RewardRow>>(SELECT_REWARD_BY_ID, [workspaceId, rewardId])
        return row === undefined ? null : toReward(row)
    }

    /** One active reward by its key, or null. */
    async byKey(workspaceId: string, key: string): Promise<RewardMatch> {
        const [row] = await this.entityManager.query<Array<RewardRow>>(SELECT_REWARD_BY_KEY, [workspaceId, key])
        return row === undefined ? null : toReward(row)
    }

    /** One reward locked for the rest of the transaction, so its stock and limits are judged on the latest values, or null. */
    async lock(manager: EntityManager, workspaceId: string, rewardId: string): Promise<RewardMatch> {
        const [row] = await manager.query<Array<RewardRow>>(LOCK_REWARD, [workspaceId, rewardId])
        return row === undefined ? null : toReward(row)
    }

    /** Takes one unit out of the stock of a reward; a reward without a stock stays as it is. */
    async takeOne(manager: EntityManager, workspaceId: string, rewardId: string): Promise<void> {
        await manager.query(TAKE_STOCK, [workspaceId, rewardId])
    }
}
