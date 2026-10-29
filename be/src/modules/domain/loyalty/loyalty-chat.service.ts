import { Injectable } from "@nestjs/common"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import type { ChatCustomerRef } from "@modules/domain/loyalty-customer-links"
import { LoyaltyLedgerService, expiringSoon } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService, tierByKey } from "@modules/domain/loyalty-programs"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService, redeemBlock } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ChatRedeemIntent, RewardLineFacts } from "./loyalty-chat.contracts"
import { rewardLineParams } from "./policies/chat-brief.policy"

const LOCALE = "vi"
/** How many rewards the chat brief lists. */
const BRIEF_REWARDS_MAX = 12

/** The facts a brief is built from. */
interface ChatFacts {
    readonly config: LoyaltyConfig
    readonly rewards: ReadonlyArray<LoyaltyReward>
    readonly member: LoyaltyMember | null
}

@Injectable()
/**
 * Loyalty in the customer chat. The chat answers "how many points do I have" and "what can I redeem" from a [LOYALTY PROGRAMME] block built
 * here from the ledger, so the numbers are never the model's; a clear "redeem this" becomes a gated `redeem_reward` work item that the
 * caller opens. A customer is recognised only through what NIVO already links to the conversation (the lead, the channel account, the
 * phone the customer gave the shop), and a chat never creates a member.
 */
export class LoyaltyChatService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly programs: LoyaltyProgramsService,
        private readonly rewards: LoyaltyRewardsService,
        private readonly ledger: LoyaltyLedgerService,
        private readonly links: LoyaltyCustomerLinksService,
    ) {}

    /** The facts block of a turn, or an empty text when the workspace runs no active programme. */
    async brief(ref: ChatCustomerRef): Promise<string> {
        const facts = await this.factsOf(ref)
        if (facts === null) return ""
        const { config, rewards, member } = facts
        const lines = [
            this.text("loyalty.chat.header"),
            this.text("loyalty.chat.earn", { points: config.earn.perThousandVnd }),
            this.text("loyalty.chat.tiers", {
                tiers: config.tiers.map((tier) => `${tier.name} (${tier.minSpendVnd})`).join("; "),
            }),
            rewards.length === 0
                ? this.text("loyalty.chat.noRewards")
                : [
                      this.text("loyalty.chat.rewards"),
                      ...rewards.map((reward) => this.text("loyalty.chat.reward", rewardLineParams(reward))),
                  ].join("\n"),
        ]
        if (member === null) return [...lines, this.text("loyalty.chat.unknown")].join("\n")
        const counts = await this.ledger.redeemedCounts(member.id)
        const open = rewards.filter(
            (reward) =>
                redeemBlock(config, reward, {
                    points: member.points,
                    tierKey: member.tierKey,
                    redeemedBefore: counts.get(reward.id) ?? 0,
                }) === null,
        )
        const expiring =
            config.expiry.months > 0
                ? expiringSoon(
                      await this.ledger.expiryEntries(member.id),
                      this.clock.now().getTime(),
                      config.expiry.warnDays,
                  )
                : { points: 0, firstAt: null }
        return [
            ...lines,
            this.text("loyalty.chat.member", {
                name: member.name,
                tier: tierByKey(config, member.tierKey)?.name ?? "-",
                points: member.points,
                spend: member.lifetimeSpendVnd,
                visits: member.visits,
            }),
            expiring.points > 0 && expiring.firstAt !== null
                ? this.text("loyalty.chat.expiring", { points: expiring.points, at: expiring.firstAt.slice(0, 10) })
                : this.text("loyalty.chat.noExpiring"),
            open.length === 0
                ? this.text("loyalty.chat.cannotRedeem")
                : this.text("loyalty.chat.canRedeem", { rewards: open.map((reward) => `"${reward.key}"`).join(", ") }),
        ].join("\n")
    }

    /** What a redeem the model proposed comes to: a request to open for the gate, a refusal with its reason, or nothing to do. */
    async redeemIntent(ref: ChatCustomerRef, rewardKey: string): Promise<ChatRedeemIntent> {
        const facts = await this.factsOf(ref)
        if (facts?.member === undefined || facts.member === null) return { kind: "none" }
        const { member, config } = facts
        const reward = facts.rewards.find((candidate) => candidate.key === rewardKey)
        if (reward === undefined) return { kind: "none" }
        const counts = await this.ledger.redeemedCounts(member.id)
        const block = redeemBlock(config, reward, {
            points: member.points,
            tierKey: member.tierKey,
            redeemedBefore: counts.get(reward.id) ?? 0,
        })
        const subject: RewardLineFacts = { customerId: member.id, customerName: member.name, reward }
        return block === null ? { kind: "open", ...subject } : { kind: "blocked", ...subject, reason: block.code }
    }

    private async factsOf(ref: ChatCustomerRef): Promise<ChatFacts | null> {
        const program = await this.programs.findActive(ref.workspaceId)
        if (program === null) return null
        const [rewards, customerId] = await Promise.all([
            this.rewards.list(ref.workspaceId, true),
            this.links.customerOfChat(ref),
        ])
        const member = customerId === null ? null : await this.ledger.member(ref.workspaceId, customerId)
        return { config: program.config, rewards: rewards.slice(0, BRIEF_REWARDS_MAX), member }
    }

    private text(key: string, params: Readonly<Record<string, string | number>> = {}): string {
        return this.catalog.get(key, params, LOCALE)
    }
}
