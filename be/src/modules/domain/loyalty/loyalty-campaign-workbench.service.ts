import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import {
    LoyaltyCampaignDraftsService,
    LoyaltyCampaignsError,
    LoyaltyCampaignsErrorCode,
    LoyaltyCampaignsService,
} from "@modules/domain/loyalty-campaigns"
import type { CampaignDraft, CampaignSubmission, LoyaltyCampaignView } from "@modules/domain/loyalty-campaigns"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type { DraftParams } from "./loyalty-promotions.service"

/** The campaign row status that follows a work-item status. */
const storedStatus = (workStatus: string): string => {
    if (workStatus === "done") return "sending"
    if (workStatus === "rejected") return "rejected"
    if (workStatus === "failed") return "failed"
    return "waiting_decision"
}

/** The work-item status a stored campaign status stands for. */
const decisionStatus = (stored: string): string => {
    if (stored === "sending") return "done"
    if (stored === "waiting") return "waiting_decision"
    return stored
}

/** The campaign requested from the active workspace. */
export interface CampaignReadParams {
    /** Selected workspace. */
    readonly workspaceId: string
    /** Campaign to inspect. */
    readonly id: string
}

@Injectable()
/** Workspace-authorized asynchronous campaign drafting and progress for the browser workbench. */
export class LoyaltyCampaignWorkbenchService {
    constructor(
        private readonly access: WorkspaceMembersService,
        private readonly campaigns: LoyaltyCampaignsService,
        private readonly drafts: LoyaltyCampaignDraftsService,
        private readonly engine: WorkEngineService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** A manager requests a message; OpenClaw runs later in the fenced job. */
    async draft(userId: string, params: DraftParams): Promise<CampaignDraft> {
        const actor = await this.access.require(userId, params.workspaceId, ["owner", "manager"])
        return this.drafts.request({ ...params, createdBy: actor.displayName })
    }

    /** A manager sends a finished draft through the approval gate and keeps the work item on the campaign. */
    async submit(userId: string, workspaceId: string, campaignId: string, locale: Locale): Promise<CampaignSubmission> {
        const actor = await this.access.require(userId, workspaceId, ["owner", "manager"])
        const campaign = await this.campaigns.get(workspaceId, campaignId)
        if (campaign.workItemId !== null) {
            return {
                campaignId: campaign.id,
                workItemId: campaign.workItemId,
                status: decisionStatus(campaign.status),
            }
        }
        if (campaign.status !== "draft") throw new LoyaltyCampaignsError({ code: LoyaltyCampaignsErrorCode.NotReady })
        const item = await this.engine.runWork(
            { workspaceId, actor: actor.displayName, locale },
            {
                action: "send_promo",
                subject_type: "lead",
                subject_id: null,
                dedupeKey: `send_promo:campaign:${campaign.id}`,
                preset: true,
                noChain: true,
                seed: {
                    summary: this.catalog.get(
                        "loyalty.campaign.submitSummary",
                        { name: campaign.name, count: campaign.recipients },
                        locale,
                    ),
                    draft: campaign.draft,
                    fields: {
                        campaign_id: campaign.id,
                        contact: String(campaign.recipients),
                        customer: campaign.name,
                    },
                },
            },
        )
        const linked = await this.campaigns.attachDecision(workspaceId, campaign.id, item.id, storedStatus(item.status))
        if (linked) return { campaignId: campaign.id, workItemId: item.id, status: item.status }
        const current = await this.campaigns.get(workspaceId, campaignId)
        if (current.workItemId === null) throw new LoyaltyCampaignsError({ code: LoyaltyCampaignsErrorCode.NotReady })
        return { campaignId: current.id, workItemId: current.workItemId, status: decisionStatus(current.status) }
    }

    /** Any workspace member may poll a campaign that belongs to that workspace. */
    async campaign(userId: string, params: CampaignReadParams): Promise<LoyaltyCampaignView> {
        await this.access.require(userId, params.workspaceId)
        return this.campaigns.get(params.workspaceId, params.id)
    }
}
