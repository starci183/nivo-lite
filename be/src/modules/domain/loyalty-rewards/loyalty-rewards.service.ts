import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LoyaltyReward, RewardEdit, RewardFields, RewardMatch, RewardRemoval } from "./loyalty-rewards.contracts"
import { rewardKey, sanitizeReward } from "./policies/reward-edit.policy"
import {
    LOCK_REWARD,
    SELECT_ACTIVE_REWARDS,
    SELECT_REWARDS,
    SELECT_REWARD_BY_ID,
    SELECT_REWARD_BY_KEY,
    TAKE_STOCK,
    UPDATE_REWARD,
    INSERT_REWARD,
    INSERT_REWARD_PRESETS,
    DELETE_REWARD,
} from "./persistence/loyalty-rewards.sql"
import { toReward } from "./persistence/loyalty-rewards.rows"
import type { RewardRow } from "./persistence/loyalty-rewards.rows"

const KEY_ATTEMPTS = 4
const NEW_REWARD_ORDER = 100

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

    /** Saves a catalogue entry; null when the existing reward is gone or a new key could not be allocated. */
    async save(workspaceId: string, edit: RewardEdit): Promise<RewardMatch> {
        const reward = sanitizeReward(edit)
        const fields = [
            reward.name,
            reward.kind,
            reward.valueVnd,
            reward.percent,
            reward.pointsCost,
            reward.stock,
            reward.perCustomerLimit,
            reward.minTierKey,
            reward.note,
            reward.active,
        ]
        if (edit.id !== undefined) {
            const [row] = await this.entityManager.query<Array<RewardRow>>(UPDATE_REWARD, [
                workspaceId,
                edit.id,
                ...fields,
            ])
            return row === undefined ? null : toReward(row)
        }
        const key = rewardKey(edit.key?.trim() || reward.name)
        return this.insertAttempt(workspaceId, key, fields, 0)
    }

    private async insertAttempt(
        workspaceId: string,
        key: string,
        fields: RewardFields,
        attempt: number,
    ): Promise<RewardMatch> {
        const [row] = await this.entityManager.query<Array<RewardRow>>(INSERT_REWARD, [
            workspaceId,
            key,
            ...fields,
            NEW_REWARD_ORDER + attempt,
            attempt > 0,
        ])
        if (row !== undefined) return toReward(row)
        return attempt + 1 >= KEY_ATTEMPTS ? null : this.insertAttempt(workspaceId, key, fields, attempt + 1)
    }

    /** Deletes unused rewards and pauses used rewards to preserve the immutable ledger history. */
    remove(workspaceId: string, rewardId: string): Promise<RewardRemoval> {
        return this.entityManager.transaction(async (manager) => {
            const reward = await this.lock(manager, workspaceId, rewardId)
            if (reward === null) return "missing"
            const [row] = await manager.query<Array<{ outcome: "deleted" | "retired" }>>(DELETE_REWARD, [
                workspaceId,
                rewardId,
            ])
            return row?.outcome ?? "missing"
        })
    }

    /** Adds the starter rewards once, including under simultaneous requests. */
    async addPresets(workspaceId: string, edits: ReadonlyArray<RewardEdit>): Promise<number> {
        const presets = edits.map((reward, index) => ({
            key: reward.key,
            name: reward.name,
            kind: reward.kind,
            value_vnd: reward.valueVnd,
            percent: reward.percent,
            points_cost: reward.pointsCost,
            stock: reward.stock,
            per_customer_limit: reward.perCustomerLimit,
            min_tier_key: reward.minTierKey,
            note: reward.note,
            sort_order: NEW_REWARD_ORDER + index,
        }))
        const rows = await this.entityManager.query<Array<{ id: string }>>(INSERT_REWARD_PRESETS, [
            workspaceId,
            JSON.stringify(presets),
        ])
        return rows.length
    }
}
