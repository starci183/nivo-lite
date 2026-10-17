import type { DynamicModule } from "@nestjs/common"
import { SUPABASE_OBJECTS } from "@modules/integrations/supabase"
import { ContentModule } from "@modules/domain/content"
import { ContentItemsModule } from "@modules/domain/content-items"
import { ContentSettingsModule } from "@modules/domain/content-settings"
import { ContentPlansModule } from "@modules/domain/content-plans"
import { ContentPillarsModule } from "@modules/domain/content-pillars"
import { ContentCadenceModule } from "@modules/domain/content-cadence"
import { ContentAiModule } from "@modules/domain/content-ai"
import { ContentPublishingModule } from "@modules/domain/content-publishing"
import { ContentMediaModule } from "@modules/domain/content-media"
import { ContentGraphqlModule } from "@features/api/content"
import { ContentSettingsGraphqlModule } from "@features/api/content-settings"
import { ContentAiGraphqlModule } from "@features/api/content-ai"
import { ContentPublishingGraphqlModule } from "@features/api/content-publishing"
import { ContentMediaGraphqlModule } from "@features/api/content-media"
import { VideoGraphqlModule } from "@features/api/video"
import { RendersGraphqlModule } from "@features/api/renders"
/** The content area of the API, in registration order. */
export const contentModules = (): Array<DynamicModule> => [
    ContentItemsModule.register({ isGlobal: true }),
    ContentSettingsModule.register({ isGlobal: true }),
    ContentPillarsModule.register({ isGlobal: true }),
    ContentCadenceModule.register({ isGlobal: true }),
    ContentAiModule.register({ isGlobal: true }),
    ContentPlansModule.register({ isGlobal: true }),
    ContentPublishingModule.register({ isGlobal: true }),
    ContentMediaModule.register({ isGlobal: true, storage: SUPABASE_OBJECTS }),
    ContentGraphqlModule.register({}),
    ContentSettingsGraphqlModule.register({}),
    ContentAiGraphqlModule.register({}),
    ContentPublishingGraphqlModule.register({}),
    ContentMediaGraphqlModule.register({}),
    VideoGraphqlModule.register({}),
    ContentModule.register({ isGlobal: true }),
    RendersGraphqlModule.register({}),
]
