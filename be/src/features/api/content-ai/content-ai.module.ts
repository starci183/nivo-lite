import { Module } from "@nestjs/common"
import { GetBrandMaterialHandler } from "./application/get-brand-material.handler"
import { GetDraftingBlockedHandler } from "./application/get-drafting-blocked.handler"
import { GetRecentTitlesHandler } from "./application/get-recent-titles.handler"
import { GetContentAiStatusHandler } from "./application/get-content-ai-status.handler"
import { RequestContentDraftHandler } from "./application/request-content-draft.handler"
import { RequestContentQuickDraftHandler } from "./application/request-content-quick-draft.handler"
import { RequestContentMonthPlanHandler } from "./application/request-content-month-plan.handler"

@Module({
    providers: [
        GetBrandMaterialHandler,
        GetDraftingBlockedHandler,
        GetRecentTitlesHandler,
        GetContentAiStatusHandler,
        RequestContentDraftHandler,
        RequestContentQuickDraftHandler,
        RequestContentMonthPlanHandler,
    ],
})
/** Application handlers of the content AI feature. */
export class ContentAiApiModule {}
