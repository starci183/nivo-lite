import { VIDEO_RENDERS_MESSAGES } from "@modules/domain/video-renders"
import { CONTENT_MESSAGES } from "@modules/domain/content"
import { CONTENT_ITEMS_MESSAGES } from "@modules/domain/content-items"
import { CONTENT_SETTINGS_MESSAGES } from "@modules/domain/content-settings"
import { CONTENT_AI_MESSAGES } from "@modules/domain/content-ai"
import { CONTENT_PLANS_MESSAGES } from "@modules/domain/content-plans"
import { CONTENT_PUBLISHING_MESSAGES } from "@modules/domain/content-publishing"
import { CONTENT_MEDIA_MESSAGES } from "@modules/domain/content-media"

/** App-wide messages catalog, preserving registration order. */
export const API_MESSAGES_4 = [
    VIDEO_RENDERS_MESSAGES,
    CONTENT_MESSAGES,
    CONTENT_ITEMS_MESSAGES,
    CONTENT_SETTINGS_MESSAGES,
    CONTENT_AI_MESSAGES,
    CONTENT_PLANS_MESSAGES,
    CONTENT_PUBLISHING_MESSAGES,
    CONTENT_MEDIA_MESSAGES,
]
