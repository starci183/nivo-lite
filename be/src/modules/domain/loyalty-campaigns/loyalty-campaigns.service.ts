import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyCampaignsError, LoyaltyCampaignsErrorCode } from "./errors/loyalty-campaigns.error"
import type { CampaignDraft, CampaignParams, Segment, SegmentPreview } from "./loyalty-campaigns.contracts"
import { COUNT_SENT_SINCE, INSERT_CAMPAIGN } from "./persistence/loyalty-campaigns.sql"
import { inSegment, segmentParts } from "./policies/segment.policy"

const SAMPLE_SIZE = 5
const REACH_SAMPLE = 200
const STORED_LOCALE = "vi"

@Injectable()
/** Promotions to a segment of the programme: who is in it, and the draft the owner then approves. Nothing reaches a customer from here. */
export class LoyaltyCampaignsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        private readonly ledger: LoyaltyLedgerService,
        private readonly links: LoyaltyCustomerLinksService,
        private readonly programs: LoyaltyProgramsService,
    ) {}

    /** How many customers a segment holds, how many of them can be written to, and the first few. */
    async preview(workspaceId: string, segment: Segment): Promise<SegmentPreview> {
        const members = await this.membersOf(workspaceId, segment)
        const reached = await this.links.countReachable(
            workspaceId,
            members.slice(0, REACH_SAMPLE).map((member) => member.id),
        )
        return {
            total: members.length,
            reachable: members.length > REACH_SAMPLE ? Math.round((reached / REACH_SAMPLE) * members.length) : reached,
            sample: members
                .slice(0, SAMPLE_SIZE)
                .map((member) => ({ id: member.id, name: member.name, tierKey: member.tierKey })),
        }
    }

    /** Writes a campaign as a draft with the template message filled with the offer; refuses a segment nobody belongs to. */
    async create(params: CampaignParams): Promise<CampaignDraft> {
        const members = await this.membersOf(params.workspaceId, params.segment)
        if (members.length === 0) throw new LoyaltyCampaignsError({ code: LoyaltyCampaignsErrorCode.NoRecipients })
        const shop = await this.programs.shopName(params.workspaceId)
        const offer =
            params.brief.trim() === ""
                ? this.messages.get("loyalty.promo.defaultOffer", {}, STORED_LOCALE)
                : params.brief.trim()
        const draft = this.messages.get("loyalty.promo.template", { shop, offer }, STORED_LOCALE)
        const name = (params.name.trim() === "" ? await this.defaultName(params) : params.name.trim()).slice(0, 100)
        const [row] = await this.entityManager.query<Array<{ id: string }>>(INSERT_CAMPAIGN, [
            params.workspaceId,
            name,
            JSON.stringify(params.segment),
            draft,
            members.length,
            params.createdBy,
        ])
        if (row === undefined) throw new LoyaltyCampaignsError({ code: LoyaltyCampaignsErrorCode.NotCreated })
        return { campaignId: row.id, status: "draft", recipients: members.length, draft }
    }

    /** How many promotions went out since an instant. */
    async sentSince(workspaceId: string, sinceIso: string): Promise<number> {
        const rows = await this.entityManager.query<Array<{ total: number }>>(COUNT_SENT_SINCE, [workspaceId, sinceIso])
        return rows.reduce((sum, row) => sum + row.total, 0)
    }

    private async membersOf(workspaceId: string, segment: Segment): Promise<ReadonlyArray<LoyaltyMember>> {
        const nowMs = this.clock.now().getTime()
        const members = await this.ledger.members(workspaceId)
        return members.filter((member) => inSegment(member, segment, nowMs))
    }

    private async defaultName(params: CampaignParams): Promise<string> {
        const program = await this.programs.find(params.workspaceId)
        const names = new Map((program?.config.tiers ?? []).map((tier) => [tier.key, tier.name]))
        const parts = segmentParts(params.segment, names).map((part) =>
            this.messages.get(part.key, part.params, STORED_LOCALE),
        )
        const label = parts.length > 0 ? parts.join(", ") : this.messages.get("loyalty.segment.all", {}, STORED_LOCALE)
        return this.messages.get("loyalty.campaign.defaultName", { segment: label }, STORED_LOCALE)
    }
}
