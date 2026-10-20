import { VIDEO_ERROR_KINDS } from "@modules/domain/video"
import { VIDEO_RENDERS_ERROR_KINDS } from "@modules/domain/video-renders"
import { CONTENT_ITEMS_ERROR_KINDS } from "@modules/domain/content-items"
import { CONTENT_SETTINGS_ERROR_KINDS } from "@modules/domain/content-settings"
import { CONTENT_AI_ERROR_KINDS } from "@modules/domain/content-ai"
import { CONTENT_PLANS_ERROR_KINDS } from "@modules/domain/content-plans"
import { CONTENT_PUBLISHING_ERROR_KINDS } from "@modules/domain/content-publishing"
import { CONTENT_MEDIA_ERROR_KINDS } from "@modules/domain/content-media"

import { MCP_GATEWAY_ERROR_KINDS } from "@modules/domain/mcp-gateway"
import { MCP_ERROR_KINDS } from "@modules/integrations/mcp"
/** App-wide errors catalog, preserving registration order. */
export const API_ERROR_KINDS_4 = [
    VIDEO_ERROR_KINDS,
    VIDEO_RENDERS_ERROR_KINDS,
    CONTENT_ITEMS_ERROR_KINDS,
    CONTENT_SETTINGS_ERROR_KINDS,
    CONTENT_AI_ERROR_KINDS,
    CONTENT_PLANS_ERROR_KINDS,
    CONTENT_PUBLISHING_ERROR_KINDS,
    CONTENT_MEDIA_ERROR_KINDS,
    MCP_ERROR_KINDS,
    MCP_GATEWAY_ERROR_KINDS,
]
