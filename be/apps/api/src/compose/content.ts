import type { DynamicModule } from "@nestjs/common"
import {
    OBJECT_STORAGE_ERROR_KINDS,
    ObjectStorageModule,
    STORAGE_ASSETS,
    STORAGE_OBJECTS,
} from "@modules/integrations/object-storage"
import type { ApiOptions } from "../api.options"
import { CONTENT_MESSAGES, ContentModule } from "@modules/domain/content"
import { CONTENT_ITEMS_ERROR_KINDS, CONTENT_ITEMS_MESSAGES, ContentItemsModule } from "@modules/domain/content-items"
import {
    CONTENT_SETTINGS_ERROR_KINDS,
    CONTENT_SETTINGS_MESSAGES,
    ContentSettingsModule,
} from "@modules/domain/content-settings"
import { CONTENT_PLANS_ERROR_KINDS, CONTENT_PLANS_MESSAGES, ContentPlansModule } from "@modules/domain/content-plans"
import { ContentPillarsModule } from "@modules/domain/content-pillars"
import { ContentCadenceModule } from "@modules/domain/content-cadence"
import {
    CONTENT_AGENT_MESSAGES,
    CONTENT_AI_ERROR_KINDS,
    CONTENT_AI_MESSAGES,
    ContentAiModule,
} from "@modules/domain/content-ai"
import {
    CONTENT_PUBLISHING_ERROR_KINDS,
    CONTENT_PUBLISHING_MESSAGES,
    ContentPublishingModule,
} from "@modules/domain/content-publishing"
import { CONTENT_MEDIA_ERROR_KINDS, CONTENT_MEDIA_MESSAGES, ContentMediaModule } from "@modules/domain/content-media"
import { ContentGraphqlModule } from "@features/api/content"
import { ContentSettingsGraphqlModule } from "@features/api/content-settings"
import { ContentAiGraphqlModule } from "@features/api/content-ai"
import { ContentPublishingGraphqlModule } from "@features/api/content-publishing"
import { ContentMediaGraphqlModule } from "@features/api/content-media"
import { VideoGraphqlModule } from "@features/api/video"
import { RendersGraphqlModule } from "@features/api/renders"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The content area of the API, in registration order. */
export const contentModules = (options: ApiOptions): Array<DynamicModule> => [
    ObjectStorageModule.register({ isGlobal: true, ...options.storage }),
    ContentItemsModule.register({ isGlobal: true }),
    ContentSettingsModule.register({ isGlobal: true }),
    ContentPillarsModule.register({ isGlobal: true }),
    ContentCadenceModule.register({ isGlobal: true }),
    ContentAiModule.register({
        isGlobal: true,
        assets: STORAGE_ASSETS,
        fontsDir: options.video.fontsDir,
        workDir: options.video.workDir,
    }),
    ContentPlansModule.register({ isGlobal: true }),
    ContentPublishingModule.register({ isGlobal: true }),
    ContentMediaModule.register({ isGlobal: true, storage: STORAGE_OBJECTS }),
    ContentGraphqlModule.register({}),
    ContentSettingsGraphqlModule.register({}),
    ContentAiGraphqlModule.register({}),
    ContentPublishingGraphqlModule.register({}),
    ContentMediaGraphqlModule.register({}),
    VideoGraphqlModule.register({}),
    ContentModule.register({ isGlobal: true }),
    RendersGraphqlModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const contentErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    OBJECT_STORAGE_ERROR_KINDS,
    CONTENT_ITEMS_ERROR_KINDS,
    CONTENT_SETTINGS_ERROR_KINDS,
    CONTENT_AI_ERROR_KINDS,
    CONTENT_PLANS_ERROR_KINDS,
    CONTENT_PUBLISHING_ERROR_KINDS,
    CONTENT_MEDIA_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const contentMessages: ReadonlyArray<MessageBundle> = [
    CONTENT_MESSAGES,
    CONTENT_ITEMS_MESSAGES,
    CONTENT_SETTINGS_MESSAGES,
    CONTENT_AI_MESSAGES,
    CONTENT_PLANS_MESSAGES,
    CONTENT_PUBLISHING_MESSAGES,
    CONTENT_MEDIA_MESSAGES,
    CONTENT_AGENT_MESSAGES,
]
