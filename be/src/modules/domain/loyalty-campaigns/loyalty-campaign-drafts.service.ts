import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { GenerationRunnerService, GenerationsService } from "@modules/domain/ai-generations"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ClaimedJob, JobFenceService } from "@modules/platform/jobs"
import { InjectJobFence } from "@modules/platform/jobs"
import { LoyaltyCampaignQueue, loyaltyCampaignPayloadOf } from "@modules/queues/loyalty-campaign"
import type { CampaignDraft, CampaignParams } from "./loyalty-campaigns.contracts"
import { LoyaltyCampaignsService } from "./loyalty-campaigns.service"
import { campaignDraftPrompt, campaignDraftText } from "./policies/campaign-draft.policy"

@Injectable()
/** Requests a campaign immediately and prepares its message in one fenced job without holding a slot for another job. */
export class LoyaltyCampaignDraftsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly campaigns: LoyaltyCampaignsService,
        private readonly generations: GenerationsService,
        private readonly runner: GenerationRunnerService,
        @InjectJobFence() private readonly fence: JobFenceService,
        private readonly queue: LoyaltyCampaignQueue,
    ) {}

    /** The waiting campaign, prepared generation and job are committed atomically; no model runs in this request. */
    request(params: CampaignParams): Promise<CampaignDraft> {
        return this.entityManager.transaction(async (tx) => {
            const campaign = await this.campaigns.prepare(params, tx)
            const generationId = await this.generations.prepare(
                {
                    workspaceId: params.workspaceId,
                    purpose: "loyalty_promo_draft",
                    messages: campaignDraftPrompt(params, campaign.draft),
                    responseFormat: "text",
                    timeoutMs: 45000,
                    kind: "engine",
                    module: "other",
                },
                tx,
            )
            await this.queue.enqueueDraft(
                { workspaceId: params.workspaceId, campaignId: campaign.campaignId, generationId },
                tx,
            )
            return campaign
        })
    }

    /** Runs a prepared generation directly through the existing runner and writes only while the job's fence is current. */
    async run(job: ClaimedJob): Promise<void> {
        const payload = loyaltyCampaignPayloadOf(job.payload)
        if (payload === null) return
        const campaign = await this.campaigns.get(payload.workspaceId, payload.campaignId)
        if (campaign.status !== "waiting") return
        const startedAt = this.clock.now().getTime()
        const output = await this.output(payload.workspaceId, payload.generationId)
        await this.fence.write(job, (tx) =>
            this.campaigns.finishDraft(
                tx,
                payload.workspaceId,
                payload.campaignId,
                campaignDraftText(output, campaign.messageDraft),
                Math.max(0, this.clock.now().getTime() - startedAt),
            ),
        )
    }

    /** Settles an exhausted queue delivery so the browser's status polling stops. */
    async abandon(payload: object): Promise<void> {
        const parsed = loyaltyCampaignPayloadOf(payload)
        if (parsed !== null) await this.campaigns.failDraft(parsed.workspaceId, parsed.campaignId)
    }

    private async output(workspaceId: string, generationId: string | null): Promise<string | null> {
        if (generationId === null) return null
        await this.runner.run({ workspaceId, generationId })
        const progress = await this.generations.progress(workspaceId, generationId)
        return progress?.status === "done" ? progress.text : null
    }
}
