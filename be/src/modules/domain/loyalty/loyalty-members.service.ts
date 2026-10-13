import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerService, expiringSoon } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService, nextTier, tierOf } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService, redeemBlock } from "@modules/domain/loyalty-rewards"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import { LoyaltyRedemptionService } from "./loyalty-redemption.service"
import type {
    AdjustParams,
    AdjustResult,
    MemberDetail,
    MemberRef,
    RedeemParams,
    RedeemResult,
    SyncResult,
    WorkspaceRef,
} from "./loyalty.contracts"

const TIMELINE_ROWS = 200
const MANAGER_ROLES = ["owner", "manager"] as const

@Injectable()
/** The owner's work on one customer and on the customer list: the detail, a manual correction, a redemption at the counter and the sync from leads. */
export class LoyaltyMembersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly access: WorkspaceMembersService,
        private readonly customers: LoyaltyCustomersService,
        private readonly links: LoyaltyCustomerLinksService,
        private readonly ledger: LoyaltyLedgerService,
        private readonly programs: LoyaltyProgramsService,
        private readonly rewards: LoyaltyRewardsService,
        private readonly redemption: LoyaltyRedemptionService,
    ) {}

    /** One customer with the newest ledger entries, the tier progress, the points about to expire and what they can redeem now. */
    async detail(userId: string, ref: MemberRef): Promise<MemberDetail> {
        await this.access.require(userId, ref.workspaceId)
        const [member, config, rewards, counts, timeline, expiry] = await Promise.all([
            this.ledger.member(ref.workspaceId, ref.customerId),
            this.programs.configOf(ref.workspaceId),
            this.rewards.list(ref.workspaceId, true),
            this.ledger.redeemedCounts(ref.customerId),
            this.ledger.timeline(ref.workspaceId, ref.customerId, TIMELINE_ROWS),
            this.ledger.expiryEntries(ref.customerId),
        ])
        if (member === null) throw new LoyaltyError({ code: LoyaltyErrorCode.MemberNotFound })
        const nowMs = this.clock.now().getTime()
        return {
            member,
            ledger: timeline,
            tierName: tierOf(config, member.tierKey)?.name ?? "",
            nextTier: nextTier(config, member.lifetimeSpendVnd),
            expiring:
                config.expiry.months > 0
                    ? expiringSoon(expiry, nowMs, config.expiry.warnDays)
                    : { points: 0, firstAt: null },
            rewards: rewards.map((reward) => ({
                reward,
                block: redeemBlock(config, reward, {
                    points: member.points,
                    tierKey: member.tierKey,
                    redeemedBefore: counts.get(reward.id) ?? 0,
                }),
            })),
        }
    }

    /** Adds or takes points by hand with the reason the owner gives; the person who corrects is on record. */
    async adjust(userId: string, params: AdjustParams): Promise<AdjustResult> {
        const actor = await this.access.require(userId, params.workspaceId, MANAGER_ROLES)
        const points = Math.round(params.points)
        if (points === 0) throw new LoyaltyError({ code: LoyaltyErrorCode.PointsRequired })
        if (params.reason.trim() === "") throw new LoyaltyError({ code: LoyaltyErrorCode.ReasonRequired })
        const occurredAt = this.clock.now().toISOString()
        const entry = await this.entityManager.transaction((manager) =>
            this.ledger.post({
                manager,
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                kind: "adjust",
                points,
                ref: `adjust:${params.token}`,
                by: actor.displayName,
                amountVnd: null,
                orderId: null,
                invoiceId: null,
                rewardId: null,
                evidence: params.reason.trim().slice(0, 300),
                expiresAt: null,
                occurredAt,
            }),
        )
        return { posted: entry !== null }
    }

    /** Redeems a reward for a customer at the counter. */
    async redeem(userId: string, params: RedeemParams): Promise<RedeemResult> {
        const actor = await this.access.require(userId, params.workspaceId)
        const outcome = await this.redemption.redeem({
            workspaceId: params.workspaceId,
            customerId: params.customerId,
            rewardId: params.rewardId,
            ref: `redeem:${params.token}`,
            by: actor.displayName,
        })
        return { code: outcome.code, posted: outcome.posted }
    }

    /** Makes a customer of every lead that has a phone or an email and links the leads and their chats to them. */
    async sync(userId: string, params: WorkspaceRef): Promise<SyncResult> {
        await this.access.require(userId, params.workspaceId, MANAGER_ROLES)
        const leads = await this.customers.leadContacts(params.workspaceId)
        return this.entityManager.transaction(async (manager) => ({
            created: await this.customers.createFromLeads(manager, params.workspaceId, leads),
            linked: await this.links.linkLeads(manager, params.workspaceId, leads),
        }))
    }
}
