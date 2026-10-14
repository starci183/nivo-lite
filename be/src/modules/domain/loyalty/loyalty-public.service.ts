import { Injectable } from "@nestjs/common"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import { LoyaltyCustomersService, toLoyaltyPhone } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerService, expiringSoon } from "@modules/domain/loyalty-ledger"
import { LoyaltyOtpsService } from "@modules/domain/loyalty-otps"
import { LoyaltyProgramsService, nextTier, tierOf } from "@modules/domain/loyalty-programs"
import type { LoyaltyProgram } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService, redeemBlock } from "@modules/domain/loyalty-rewards"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import { InjectCodeDelivery } from "./loyalty.decorators"
import type {
    CodeDelivery,
    PublicPageParams,
    PublicProgramView,
    RequestCodeAnswer,
    RequestCodeParams,
    VerifyCodeAnswer,
    VerifyCodeParams,
} from "./loyalty.contracts"

const MINUTE_MS = 60_000
const CODE_LIFETIME_MIN = 10
const CODES_PER_CUSTOMER = 3
const CODES_PER_WORKSPACE_HOUR = 30
const STORED_LOCALE = "vi"
const PUSH_CHANNELS: ReadonlyArray<string> = ["telegram", "zalo"]
const SAME_ANSWER: RequestCodeAnswer = { ok: true, code: "none" }
const WRONG: VerifyCodeAnswer = { ok: false, code: "wrong", points: null }

@Injectable()
/**
 * The public points check of one shop. A visitor types a phone; when it belongs to a customer who has a Telegram or Zalo chat with the shop a
 * six-digit code goes THERE and the visitor types it back to see their points. The answer to "send the code" is always the same, so the
 * page cannot be used to find out who is a customer.
 */
export class LoyaltyPublicService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        @InjectCodeDelivery() private readonly delivery: CodeDelivery,
        private readonly programs: LoyaltyProgramsService,
        private readonly customers: LoyaltyCustomersService,
        private readonly links: LoyaltyCustomerLinksService,
        private readonly otps: LoyaltyOtpsService,
        private readonly ledger: LoyaltyLedgerService,
        private readonly rewards: LoyaltyRewardsService,
    ) {}

    /** The name of the shop and of its programme, for the page that asks for the phone. */
    async page(params: PublicPageParams): Promise<PublicProgramView> {
        const program = await this.programs.findBySlug(params.slug)
        if (program === null) throw new LoyaltyError({ code: LoyaltyErrorCode.PageNotFound })
        const shop = program.name === "" ? await this.programs.shopName(program.workspaceId) : program.name
        return { slug: program.slug, shop, name: program.name }
    }

    /** Sends a code to the customer's own chat when there is one; the answer never tells whether it did. */
    async requestCode(params: RequestCodeParams): Promise<RequestCodeAnswer> {
        const phone = toLoyaltyPhone(params.phone)
        if (phone === null) return { ok: false, code: "bad_phone" }
        const program = await this.programs.findBySlug(params.slug)
        if (program === null) return { ok: false, code: "closed" }
        const nowMs = this.clock.now().getTime()
        const workspaceId = program.workspaceId
        if (
            (await this.otps.workspaceCodesSince(workspaceId, new Date(nowMs - 60 * MINUTE_MS).toISOString())) >=
            CODES_PER_WORKSPACE_HOUR
        ) {
            return { ok: false, code: "busy" }
        }
        const customer = await this.customers.byPhone(workspaceId, phone)
        if (customer === null) return SAME_ANSWER
        const recent = await this.otps.customerCodesSince(
            customer.id,
            new Date(nowMs - CODE_LIFETIME_MIN * MINUTE_MS).toISOString(),
        )
        if (recent >= CODES_PER_CUSTOMER) return SAME_ANSWER
        const target = await this.links.pushConversation(workspaceId, customer.id)
        if (target === null || target.channel === null || !PUSH_CHANNELS.includes(target.channel)) return SAME_ANSWER
        const issued = await this.otps.issue(
            workspaceId,
            customer.id,
            new Date(nowMs + CODE_LIFETIME_MIN * MINUTE_MS).toISOString(),
        )
        const shop = await this.programs.shopName(workspaceId)
        const text = this.messages.get("loyalty.otp.message", { shop, code: issued.code }, STORED_LOCALE)
        const delivered = await this.delivery.send({ workspaceId, conversationId: target.id, text })
        if (!delivered) await this.otps.discard(issued.id)
        return SAME_ANSWER
    }

    /** Shows the points of the customer whose phone and typed code are right. */
    async verifyCode(params: VerifyCodeParams): Promise<VerifyCodeAnswer> {
        const phone = toLoyaltyPhone(params.phone)
        const typed = params.typed.replace(/\D/gu, "")
        if (phone === null || typed.length !== 6) return WRONG
        const program = await this.programs.findBySlug(params.slug)
        if (program === null) return { ok: false, code: "closed", points: null }
        const customer = await this.customers.byPhone(program.workspaceId, phone)
        if (customer === null || (await this.otps.check(customer.id, typed)) === "rejected") return WRONG
        return this.pointsOf(program, customer.id)
    }

    private async pointsOf(program: LoyaltyProgram, customerId: string): Promise<VerifyCodeAnswer> {
        const [member, rewards, counts, expiry, shop] = await Promise.all([
            this.ledger.member(program.workspaceId, customerId),
            this.rewards.list(program.workspaceId, true),
            this.ledger.redeemedCounts(customerId),
            this.ledger.expiryEntries(customerId),
            this.programs.shopName(program.workspaceId),
        ])
        if (member === null) return WRONG
        const config = program.config
        return {
            ok: true,
            code: "none",
            points: {
                shop,
                name: member.name,
                tierName: tierOf(config, member.tierKey)?.name ?? "",
                points: member.points,
                nextTier: nextTier(config, member.lifetimeSpendVnd),
                expiring:
                    config.expiry.months > 0
                        ? expiringSoon(expiry, this.clock.now().getTime(), config.expiry.warnDays)
                        : { points: 0, firstAt: null },
                rewards: rewards.map((reward) => ({
                    name: reward.name,
                    pointsCost: reward.pointsCost,
                    note: reward.note,
                    canRedeem:
                        redeemBlock(config, reward, {
                            points: member.points,
                            tierKey: member.tierKey,
                            redeemedBefore: counts.get(reward.id) ?? 0,
                        }) === null,
                })),
            },
        }
    }
}
