import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import type { CampaignDraft } from "@modules/domain/loyalty-campaigns"
import { LoyaltyCustomersService, toLoyaltyPhone } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService, tierOf } from "@modules/domain/loyalty-programs"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LoyaltyError, LoyaltyErrorCode } from "./errors/loyalty.error"
import { LoyaltyEarningService } from "./loyalty-earning.service"
import { LoyaltyRedemptionService } from "./loyalty-redemption.service"
import type {
    ApiAwardParams,
    ApiAwardResult,
    ApiMember,
    ApiMembersParams,
    ApiMembersResult,
    ApiPromoParams,
    ApiRedeemParams,
    ApiRedeemResult,
} from "./loyalty.contracts"
import { AUTHENTICATE_API_KEY } from "./persistence/loyalty.sql"
import { bearerKey, hashApiKey, verdictOf } from "./policies/api-key.policy"
import type { ApiKeyAuth, KeyVerdict } from "./policies/api-key.policy"

const DEFAULT_LIMIT = 50

const VERDICT_ERRORS: Readonly<Record<KeyVerdict, LoyaltyErrorCode>> = {
    ok: LoyaltyErrorCode.KeyInvalid,
    invalid: LoyaltyErrorCode.KeyInvalid,
    revoked: LoyaltyErrorCode.KeyRevoked,
    rate_limited: LoyaltyErrorCode.KeyRateLimited,
    scope_missing: LoyaltyErrorCode.ScopeMissing,
}

/** The workspace an API key acts for. */
interface ApiPrincipal {
    /** The key id. */
    readonly keyId: string
    /** The workspace. */
    readonly workspaceId: string
    /** The name of the key. */
    readonly name: string
}

@Injectable()
/**
 * The loyalty endpoints for a till that is not part of NIVO's own sales flow (scopes loyalty:read and loyalty:write). The key is checked
 * here until the api-key capability of the public API takes it over.
 */
export class LoyaltyApiService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly programs: LoyaltyProgramsService,
        private readonly customers: LoyaltyCustomersService,
        private readonly ledger: LoyaltyLedgerService,
        private readonly rewards: LoyaltyRewardsService,
        private readonly earning: LoyaltyEarningService,
        private readonly redemption: LoyaltyRedemptionService,
        private readonly campaigns: LoyaltyCampaignsService,
    ) {}

    /** One customer by phone, or the newest customers. */
    async members(params: ApiMembersParams): Promise<ApiMembersResult> {
        const principal = await this.authenticate(params.authorization, "loyalty:read")
        const config = await this.activeConfig(principal.workspaceId)
        const wanted = params.phone ?? ""
        if (wanted === "") {
            const people = await this.ledger.members(principal.workspaceId)
            return {
                members: people.slice(0, params.limit ?? DEFAULT_LIMIT).map((member) => this.view(member, config)),
            }
        }
        const phone = this.phoneOf(wanted)
        const customer = await this.customers.byPhone(principal.workspaceId, phone)
        const member = customer === null ? null : await this.ledger.member(principal.workspaceId, customer.id)
        return { members: member === null ? [] : [this.view(member, config)] }
    }

    /** Points for a sale the shop made outside NIVO; the receipt id makes a repeated report harmless. */
    async award(params: ApiAwardParams): Promise<ApiAwardResult> {
        const principal = await this.authenticate(params.authorization, "loyalty:write")
        const config = await this.activeConfig(principal.workspaceId)
        const phone = this.phoneOf(params.phone)
        const amount = Math.round(params.amountVnd)
        if (!Number.isFinite(amount) || amount <= 0) throw new LoyaltyError({ code: LoyaltyErrorCode.AmountInvalid })
        const outcome = await this.earning.earn({
            workspaceId: principal.workspaceId,
            phone,
            name: params.name,
            amountVnd: amount,
            items: params.items,
            ref: `pos:${principal.keyId.slice(0, 8)}:${params.ref}`,
            by: `api:${principal.name}`,
            occurredAt: params.occurredAt,
        })
        return {
            status: outcome.status,
            customer: await this.viewOf(principal.workspaceId, outcome.customerId, config),
        }
    }

    /** A reward for a customer named by phone or id. */
    async redeem(params: ApiRedeemParams): Promise<ApiRedeemResult> {
        const principal = await this.authenticate(params.authorization, "loyalty:write")
        const config = await this.activeConfig(principal.workspaceId)
        if (params.phone === "" && params.customerId === "")
            throw new LoyaltyError({ code: LoyaltyErrorCode.ContactRequired })
        const customer =
            params.phone === ""
                ? await this.customers.byId(principal.workspaceId, params.customerId)
                : await this.customers.byPhone(principal.workspaceId, this.phoneOf(params.phone))
        if (customer === null) throw new LoyaltyError({ code: LoyaltyErrorCode.MemberNotFound })
        const reward = await this.rewards.byKey(principal.workspaceId, params.rewardKey)
        if (reward === null) throw new LoyaltyError({ code: LoyaltyErrorCode.RewardNotFound })
        const outcome = await this.redemption.redeem({
            workspaceId: principal.workspaceId,
            customerId: customer.id,
            rewardId: reward.id,
            ref: `redeem:api:${principal.keyId.slice(0, 8)}:${params.ref}`,
            by: `api:${principal.name}`,
        })
        return {
            status: outcome.posted ? "done" : "duplicate",
            code: outcome.code,
            reward: { key: reward.key, name: reward.name, valueVnd: reward.valueVnd, pointsCost: reward.pointsCost },
            customer: await this.viewOf(principal.workspaceId, customer.id, config),
        }
    }

    /** The draft of a promotion to a segment; it waits for the owner and nothing is sent. */
    async promo(params: ApiPromoParams): Promise<CampaignDraft> {
        const principal = await this.authenticate(params.authorization, "loyalty:write")
        await this.activeConfig(principal.workspaceId)
        return this.campaigns.create({
            workspaceId: principal.workspaceId,
            name: params.name,
            segment: params.segment,
            brief: params.brief,
            createdBy: `api:${principal.name}`,
        })
    }

    private async authenticate(header: string, scope: string): Promise<ApiPrincipal> {
        const key = bearerKey(header)
        const [row] = await this.entityManager.query<Array<{ auth: ApiKeyAuth | null }>>(AUTHENTICATE_API_KEY, [
            hashApiKey(key),
        ])
        const auth = row === undefined ? null : row.auth
        const verdict = verdictOf(key, auth, scope)
        if (auth === null || verdict !== "ok") throw new LoyaltyError({ code: VERDICT_ERRORS[verdict] })
        return { keyId: auth.id, workspaceId: auth.workspace_id, name: auth.name }
    }

    private async activeConfig(workspaceId: string): Promise<LoyaltyConfig> {
        const program = await this.programs.findActive(workspaceId)
        if (program === null) throw new LoyaltyError({ code: LoyaltyErrorCode.ProgramOff })
        return program.config
    }

    private phoneOf(raw: string): string {
        const phone = toLoyaltyPhone(raw)
        if (phone === null) throw new LoyaltyError({ code: LoyaltyErrorCode.PhoneInvalid })
        return phone
    }

    private async viewOf(workspaceId: string, customerId: string, config: LoyaltyConfig): Promise<ApiMember> {
        const member = await this.ledger.member(workspaceId, customerId)
        if (member === null) throw new LoyaltyError({ code: LoyaltyErrorCode.MemberNotFound })
        return this.view(member, config)
    }

    private view(member: LoyaltyMember, config: LoyaltyConfig): ApiMember {
        return {
            customerId: member.id,
            name: member.name,
            phone: member.phone,
            email: member.email,
            tier: tierOf(config, member.tierKey)?.name ?? null,
            points: member.points,
            lifetimeSpendVnd: member.lifetimeSpendVnd,
            visits: member.visits,
            lastVisitAt: member.lastVisitAt,
        }
    }
}
