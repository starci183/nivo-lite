import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService, redeemBlock } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import { redeemCode } from "./policies/ledger-note.policy"

const STORED_LOCALE = "vi"

/** A reward to redeem for a customer. */
export interface RedemptionParams {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer. */
    readonly customerId: string
    /** The reward. */
    readonly rewardId: string
    /** The idempotency key: redeeming it twice takes the points once. */
    readonly ref: string
    /** Who redeems: a person or an API key. */
    readonly by: string
}

/** What a redemption came to. */
export interface RedemptionOutcome {
    /** The code the customer shows to receive the reward. */
    readonly code: string
    /** Whether the points were taken now; false when the key was used before. */
    readonly posted: boolean
    /** The reward. */
    readonly reward: LoyaltyReward
}

@Injectable()
/** Redeems a reward: checked against the live balance, stock, limit and tier, then the points and the stock move in one transaction. */
export class LoyaltyRedemptionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        private readonly ledger: LoyaltyLedgerService,
        private readonly rewards: LoyaltyRewardsService,
        private readonly programs: LoyaltyProgramsService,
    ) {}

    /** Takes the points of the reward from the customer and gives the customer the code; a key used before changes nothing. */
    async redeem(params: RedemptionParams): Promise<RedemptionOutcome> {
        const config = await this.programs.configOf(params.workspaceId)
        const code = redeemCode(params.ref)
        const [member, counts, seen] = await Promise.all([
            this.ledger.member(params.workspaceId, params.customerId),
            this.ledger.redeemedCounts(params.customerId),
            this.ledger.hasRef(params.workspaceId, params.ref),
        ])
        if (member === null) throw new LoyaltyError({ code: LoyaltyErrorCode.MemberNotFound })
        const occurredAt = this.clock.now().toISOString()
        return this.entityManager.transaction(async (manager) => {
            const reward = await this.rewards.lock(manager, params.workspaceId, params.rewardId)
            if (reward === null) throw new LoyaltyError({ code: LoyaltyErrorCode.RewardNotFound })
            if (seen) return { code, posted: false, reward }
            const block = redeemBlock(config, reward, {
                points: member.points,
                tierKey: member.tierKey,
                redeemedBefore: counts.get(reward.id) ?? 0,
            })
            if (block !== null) {
                throw new LoyaltyError({
                    code: LoyaltyErrorCode.NotRedeemable,
                    params: { reason: block.code, ...block.params },
                })
            }
            const entry = await this.ledger.post({
                manager,
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                kind: "redeem",
                points: -reward.pointsCost,
                ref: params.ref,
                by: params.by,
                amountVnd: reward.valueVnd,
                orderId: null,
                invoiceId: null,
                rewardId: reward.id,
                evidence: this.messages.get("loyalty.redeem.evidence", { name: reward.name, code }, STORED_LOCALE),
                expiresAt: null,
                occurredAt,
            })
            if (entry !== null) await this.rewards.takeOne(manager, params.workspaceId, reward.id)
            return { code, posted: entry !== null, reward }
        })
    }
}
