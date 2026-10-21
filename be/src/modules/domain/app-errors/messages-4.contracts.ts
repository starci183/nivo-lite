import { VIDEO_RENDERS_MESSAGES } from "@modules/domain/video-renders"
import { CONTENT_MESSAGES } from "@modules/domain/content"
import { CONTENT_ITEMS_MESSAGES } from "@modules/domain/content-items"
import { CONTENT_SETTINGS_MESSAGES } from "@modules/domain/content-settings"
import { CONTENT_AGENT_MESSAGES, CONTENT_AI_MESSAGES } from "@modules/domain/content-ai"
import { CONTENT_PLANS_MESSAGES } from "@modules/domain/content-plans"
import { CONTENT_PUBLISHING_MESSAGES } from "@modules/domain/content-publishing"
import { CONTENT_MEDIA_MESSAGES } from "@modules/domain/content-media"
import { MESSAGES_MESSAGES } from "@modules/domain/messages"
import { OFFICE_ROOMS_MESSAGES } from "@modules/domain/office-rooms"
import { GATEWAY_TURNS_MESSAGES } from "@modules/domain/customer-turns"
import { MCP_GATEWAY_MESSAGES } from "@modules/domain/mcp-gateway"
import { MCP_MESSAGES } from "@modules/integrations/mcp"

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
    MESSAGES_MESSAGES,
    OFFICE_ROOMS_MESSAGES,
    MCP_MESSAGES,
    MCP_GATEWAY_MESSAGES,
    GATEWAY_TURNS_MESSAGES,
    CONTENT_AGENT_MESSAGES,
]
