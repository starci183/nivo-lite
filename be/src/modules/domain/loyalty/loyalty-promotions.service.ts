import { Injectable } from "@nestjs/common"
import { LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import type { CampaignDraft, Segment, SegmentPreview } from "@modules/domain/loyalty-campaigns"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"

const MANAGER_ROLES = ["owner", "manager"] as const

/** The segment a preview is asked for. */
export interface PreviewParams {
    /** The workspace. */
    readonly workspaceId: string
    /** Who the promotion would be for. */
    readonly segment: Segment
}

/** The campaign the owner asks for. */
export interface DraftParams extends PreviewParams {
    /** The name of the campaign, or empty. */
    readonly name: string
    /** The offer in the owner's words. */
    readonly brief: string
}

@Injectable()
/** The owner's promotions: who a segment holds, and the draft of a message to them. Nothing is sent from here. */
export class LoyaltyPromotionsService {
    constructor(
        private readonly access: WorkspaceMembersService,
        private readonly campaigns: LoyaltyCampaignsService,
    ) {}

    /** How many customers a segment holds, how many can be written to and the first few. */
    async preview(userId: string, params: PreviewParams): Promise<SegmentPreview> {
        await this.access.require(userId, params.workspaceId)
        return this.campaigns.preview(params.workspaceId, params.segment)
    }

    /** Writes the draft of a promotion to a segment, in the name of the manager who asks. */
    async draft(userId: string, params: DraftParams): Promise<CampaignDraft> {
        const actor = await this.access.require(userId, params.workspaceId, MANAGER_ROLES)
        return this.campaigns.create({
            workspaceId: params.workspaceId,
            name: params.name,
            segment: params.segment,
            brief: params.brief,
            createdBy: actor.displayName,
        })
    }
}
