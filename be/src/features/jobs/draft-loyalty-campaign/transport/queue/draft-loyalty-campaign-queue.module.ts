import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { DraftLoyaltyCampaignModule } from "../../draft-loyalty-campaign.module"
import { DraftLoyaltyCampaignProcessor } from "./draft-loyalty-campaign.processor"

@Module({ imports: [DraftLoyaltyCampaignModule], providers: [DraftLoyaltyCampaignProcessor] })
/** Registers campaign drafting with the fenced job runner composed by the API app. */
export class DraftLoyaltyCampaignQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DraftLoyaltyCampaignProcessor,
    ) {}

    /** Routes campaign draft jobs after all providers have been constructed. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
