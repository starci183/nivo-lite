import { Module } from "@nestjs/common"
import { GetBrandMaterialHandler } from "./application/get-brand-material.handler"
import { GetDraftingBlockedHandler } from "./application/get-drafting-blocked.handler"
import { GetRecentTitlesHandler } from "./application/get-recent-titles.handler"
import { GetContentAiStatusHandler } from "./application/get-content-ai-status.handler"
import { RequestContentDraftHandler } from "./application/request-content-draft.handler"
import { RequestContentQuickDraftHandler } from "./application/request-content-quick-draft.handler"
import { RequestContentMonthPlanHandler } from "./application/request-content-month-plan.handler"
import { DecideBrandProposalHandler } from "./application/decide-brand-proposal.handler"
import { GetMarketingReportHandler } from "./application/get-marketing-report.handler"
import { ListBrandProposalsHandler } from "./application/list-brand-proposals.handler"
import { PostMarketingReportHandler } from "./application/post-marketing-report.handler"
import { ProposeBrandKitHandler } from "./application/propose-brand-kit.handler"
import { ConfigurableModuleClass } from "./content-ai.module-definition"

@Module({
    providers: [
        GetBrandMaterialHandler,
        GetDraftingBlockedHandler,
        GetRecentTitlesHandler,
        GetContentAiStatusHandler,
        RequestContentDraftHandler,
        RequestContentQuickDraftHandler,
        RequestContentMonthPlanHandler,
        ProposeBrandKitHandler,
        ListBrandProposalsHandler,
        DecideBrandProposalHandler,
        GetMarketingReportHandler,
        PostMarketingReportHandler,
    ],
})
/** Application handlers of the content AI feature. */
export class ContentAiApiModule extends ConfigurableModuleClass {}
