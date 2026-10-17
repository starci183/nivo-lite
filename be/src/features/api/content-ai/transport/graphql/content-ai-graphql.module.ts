import { Module } from "@nestjs/common"
import { ContentAiApiModule } from "../../content-ai.module"
import { ConfigurableModuleClass } from "./content-ai-graphql.module-definition"
import { GetBrandMaterialResolver } from "./get-brand-material.resolver"
import { GetDraftingBlockedResolver } from "./get-drafting-blocked.resolver"
import { GetRecentTitlesResolver } from "./get-recent-titles.resolver"
import { GetContentAiStatusResolver } from "./get-content-ai-status.resolver"
import { RequestContentDraftResolver } from "./request-content-draft.resolver"
import { RequestContentQuickDraftResolver } from "./request-content-quick-draft.resolver"
import { RequestContentMonthPlanResolver } from "./request-content-month-plan.resolver"

@Module({
    imports: [ContentAiApiModule.register({})],
    providers: [
        GetBrandMaterialResolver,
        GetDraftingBlockedResolver,
        GetRecentTitlesResolver,
        GetContentAiStatusResolver,
        RequestContentDraftResolver,
        RequestContentQuickDraftResolver,
        RequestContentMonthPlanResolver,
    ],
})
/** GraphQL transport of the content AI workbench. */
export class ContentAiGraphqlModule extends ConfigurableModuleClass {}
