import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { sql } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyCampaignsError, LoyaltyCampaignsErrorCode } from "./errors/loyalty-campaigns.error"
import type {
    CampaignDraft,
    CampaignParams,
    LoyaltyCampaignView,
    Segment,
    SegmentPreview,
} from "./loyalty-campaigns.contracts"
import { loyaltyCampaignOf } from "./loyalty-campaigns.mapper"
import type { LoyaltyCampaignRow } from "./persistence/loyalty-campaigns.rows"
import {
    COUNT_SENT_SINCE,
    FAIL_CAMPAIGN_DRAFT,
    FINISH_CAMPAIGN_DRAFT,
    INSERT_CAMPAIGN,
    INSERT_WAITING_CAMPAIGN,
    LIST_CAMPAIGNS,
} from "./persistence/loyalty-campaigns.sql"
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
    create(params: CampaignParams): Promise<CampaignDraft> {
        return this.writeDraft(params, this.entityManager, INSERT_CAMPAIGN, "draft")
    }

    /** Writes a waiting campaign in the producer's transaction; the worker may replace its safe template draft. */
    prepare(params: CampaignParams, tx: EntityManager): Promise<CampaignDraft> {
        return this.writeDraft(params, tx, INSERT_WAITING_CAMPAIGN, "waiting")
    }

    /** The newest campaigns and delivery counts, always inside the selected workspace. */
    async list(workspaceId: string, limit: number = 20): Promise<ReadonlyArray<LoyaltyCampaignView>> {
        const rows = await this.entityManager.query<Array<LoyaltyCampaignRow>>(LIST_CAMPAIGNS, [
            workspaceId,
            null,
            Math.min(100, Math.max(1, limit)),
        ])
        return rows.map(loyaltyCampaignOf)
    }

    /** Reads one campaign for polling; ids from a different workspace disclose nothing. */
    async get(workspaceId: string, id: string): Promise<LoyaltyCampaignView> {
        const [row] = await this.entityManager.query<Array<LoyaltyCampaignRow>>(LIST_CAMPAIGNS, [workspaceId, id, 1])
        if (row === undefined) throw new LoyaltyCampaignsError({ code: LoyaltyCampaignsErrorCode.NotFound })
        return loyaltyCampaignOf(row)
    }

    /** Stores the message only if the job still holds its fencing token and the campaign is still waiting. */
    async finishDraft(
        tx: EntityManager,
        workspaceId: string,
        campaignId: string,
        draft: string,
        durationMs: number,
    ): Promise<void> {
        await tx.query(FINISH_CAMPAIGN_DRAFT, [workspaceId, campaignId, draft, durationMs])
    }

    /** The queue exhausted its retries; completed drafts and approved campaigns are left alone. */
    async failDraft(workspaceId: string, campaignId: string): Promise<void> {
        await this.entityManager.query(FAIL_CAMPAIGN_DRAFT, [workspaceId, campaignId])
    }

    private async writeDraft(
        params: CampaignParams,
        tx: EntityManager,
        statement: ReturnType<typeof sql>,
        status: string,
    ): Promise<CampaignDraft> {
        const members = await this.membersOf(params.workspaceId, params.segment)
        if (members.length === 0) throw new LoyaltyCampaignsError({ code: LoyaltyCampaignsErrorCode.NoRecipients })
        const shop = await this.programs.shopName(params.workspaceId)
        const offer =
            params.brief.trim() === ""
                ? this.messages.get("loyalty.promo.defaultOffer", {}, STORED_LOCALE)
                : params.brief.trim()
        const draft = this.messages.get("loyalty.promo.template", { shop, offer }, STORED_LOCALE)
        const name = (params.name.trim() === "" ? await this.defaultName(params) : params.name.trim()).slice(0, 100)
        const [row] = await tx.query<Array<{ id: string }>>(statement, [
            params.workspaceId,
            name,
            JSON.stringify(params.segment),
            draft,
            members.length,
            params.createdBy,
        ])
        if (row === undefined) throw new LoyaltyCampaignsError({ code: LoyaltyCampaignsErrorCode.NotCreated })
        return { campaignId: row.id, status, recipients: members.length, draft }
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
