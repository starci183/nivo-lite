import { Injectable } from "@nestjs/common"
import { LoyaltyCampaignDraftsService, LoyaltyCampaignsService } from "@modules/domain/loyalty-campaigns"
import type { CampaignDraft, LoyaltyCampaignView } from "@modules/domain/loyalty-campaigns"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { DraftParams } from "./loyalty-promotions.service"

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
    ) {}

    /** A manager requests a message; OpenClaw runs later in the fenced job. */
    async draft(userId: string, params: DraftParams): Promise<CampaignDraft> {
        const actor = await this.access.require(userId, params.workspaceId, ["owner", "manager"])
        return this.drafts.request({ ...params, createdBy: actor.displayName })
    }

    /** Any workspace member may poll a campaign that belongs to that workspace. */
    async campaign(userId: string, params: CampaignReadParams): Promise<LoyaltyCampaignView> {
        await this.access.require(userId, params.workspaceId)
        return this.campaigns.get(params.workspaceId, params.id)
    }
}
