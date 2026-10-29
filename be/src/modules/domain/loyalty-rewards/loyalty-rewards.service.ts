import { Injectable } from "@nestjs/common"
import { IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LoyaltyReward, RewardEdit, RewardMatch, RewardRemoval } from "./loyalty-rewards.contracts"
import { LoyaltyRewardEntity } from "./persistence/entities"
import { rewardKey, sanitizeReward } from "./policies/reward-edit.policy"
import { REWARD_RETURNING, toReward, toRewardFromRaw } from "./policies/reward.mapper"
import type { RewardRaw } from "./policies/reward.mapper"

const KEY_ATTEMPTS = 4
const NEW_REWARD_ORDER = 100

/** The most rewards one catalogue read answers. */
const CATALOGUE_LIMIT = 200

/** The key of a retried reward: the wanted key and four random hex characters, so a collision is left for another attempt. */
const SUFFIXED_KEY = "CAST(:wantedKey AS text) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)"

@Injectable()
/** The reward catalogue of a workspace: read for customers and owners, and the stock taken when a reward is redeemed. */
export class LoyaltyRewardsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The catalogue in display order; only the rewards customers may redeem now when `onlyActive`. */
    async list(workspaceId: string, onlyActive: boolean): Promise<ReadonlyArray<LoyaltyReward>> {
        const rewards = await this.entityManager.find(LoyaltyRewardEntity, {
            where: onlyActive ? { workspaceId, active: true } : { workspaceId },
            order: { sortOrder: "ASC", pointsCost: "ASC" },
            take: CATALOGUE_LIMIT,
        })
        return rewards.map(toReward)
    }

    /** One reward by id, or null. */
    async byId(workspaceId: string, rewardId: string): Promise<RewardMatch> {
        const reward = await this.entityManager.findOne(LoyaltyRewardEntity, { where: { workspaceId, id: rewardId } })
        return reward === null ? null : toReward(reward)
    }

    /** One active reward by its key, or null. */
    async byKey(workspaceId: string, key: string): Promise<RewardMatch> {
        const reward = await this.entityManager.findOne(LoyaltyRewardEntity, {
            where: { workspaceId, key, active: true },
        })
        return reward === null ? null : toReward(reward)
    }

    /** One reward locked for the rest of the transaction, so its stock and limits are judged on the latest values, or null. */
    async lock(manager: EntityManager, workspaceId: string, rewardId: string): Promise<RewardMatch> {
        const reward = await manager.findOne(LoyaltyRewardEntity, {
            where: { workspaceId, id: rewardId },
            lock: { mode: "pessimistic_write" },
        })
        return reward === null ? null : toReward(reward)
    }

    /** Takes one unit out of the stock of a reward; a reward without a stock stays as it is. */
    async takeOne(manager: EntityManager, workspaceId: string, rewardId: string): Promise<void> {
        await manager.decrement(LoyaltyRewardEntity, { workspaceId, id: rewardId, stock: Not(IsNull()) }, "stock", 1)
    }

    /** Saves a catalogue entry; null when the existing reward is gone or a new key could not be allocated. */
    async save(workspaceId: string, edit: RewardEdit): Promise<RewardMatch> {
        const reward = sanitizeReward(edit)
        const fields = {
            name: reward.name,
            kind: reward.kind,
            valueVnd: reward.valueVnd,
            percent: reward.percent,
            pointsCost: reward.pointsCost,
            stock: reward.stock,
            perCustomerLimit: reward.perCustomerLimit,
            minTierKey: reward.minTierKey,
            note: reward.note,
            active: reward.active,
        }
        if (edit.id !== undefined) {
            const updated = await this.entityManager
                .createQueryBuilder(LoyaltyRewardEntity, "lr")
                .update()
                .set(fields)
                .where("workspace_id = :workspaceId AND id = :id", { workspaceId, id: edit.id })
                .returning(REWARD_RETURNING)
                .execute()
            const [row] = updated.raw as Array<RewardRaw>
            return row === undefined ? null : toRewardFromRaw(row)
        }
        const key = rewardKey(edit.key?.trim() || reward.name)
        return this.insertAttempt(workspaceId, key, fields, 0)
    }

    /** Creates a reward, leaving a key collision for a retry with a suffixed key and the next display order. */
    private async insertAttempt(
        workspaceId: string,
        key: string,
        fields: Omit<Partial<LoyaltyRewardEntity>, "id" | "workspaceId" | "key">,
        attempt: number,
    ): Promise<RewardMatch> {
        const inserted = await this.entityManager
            .createQueryBuilder(LoyaltyRewardEntity, "lr")
            .insert()
            .values({
                ...fields,
                workspaceId,
                key: attempt > 0 ? () => SUFFIXED_KEY : key,
                sortOrder: NEW_REWARD_ORDER + attempt,
            })
            .setParameter("wantedKey", key)
            .orIgnore()
            .returning(REWARD_RETURNING)
            .execute()
        const [row] = inserted.raw as Array<RewardRaw>
        if (row !== undefined) return toRewardFromRaw(row)
        return attempt + 1 >= KEY_ATTEMPTS ? null : this.insertAttempt(workspaceId, key, fields, attempt + 1)
    }

    /** Deletes unused rewards and pauses used rewards to preserve the immutable ledger history. */
    remove(workspaceId: string, rewardId: string): Promise<RewardRemoval> {
        return this.entityManager.transaction(async (manager) => {
            const reward = await this.lock(manager, workspaceId, rewardId)
            if (reward === null) return "missing"
            const used = await manager
                .createQueryBuilder()
                .select("1", "used")
                .from("public.loyalty_ledger", "l")
                .where("l.reward_id = :rewardId", { rewardId })
                .limit(1)
                .getRawOne<{ used: number }>()
            const criteria = { workspaceId, id: rewardId }
            const outcome =
                used === undefined
                    ? await manager.delete(LoyaltyRewardEntity, criteria)
                    : await manager.update(LoyaltyRewardEntity, criteria, { active: false })
            if ((outcome.affected ?? 0) === 0) return "missing"
            return used === undefined ? "deleted" : "retired"
        })
    }

    /** Adds the starter rewards once, including under simultaneous requests. */
    async addPresets(workspaceId: string, edits: ReadonlyArray<RewardEdit>): Promise<number> {
        if (edits.length === 0) return 0
        const inserted = await this.entityManager
            .createQueryBuilder(LoyaltyRewardEntity, "lr")
            .insert()
            .values(
                edits.map((reward, index) => ({
                    workspaceId,
                    key: reward.key ?? "",
                    name: reward.name,
                    kind: reward.kind,
                    valueVnd: reward.valueVnd,
                    percent: reward.percent,
                    pointsCost: reward.pointsCost,
                    stock: reward.stock,
                    perCustomerLimit: reward.perCustomerLimit,
                    minTierKey: reward.minTierKey,
                    note: reward.note,
                    active: true,
                    sortOrder: NEW_REWARD_ORDER + index,
                })),
            )
            .orIgnore()
            .returning("id")
            .execute()
        return (inserted.raw as Array<unknown>).length
    }
}
