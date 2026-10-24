import { VIDEO_ERROR_KINDS } from "@modules/domain/video"
import { VIDEO_RENDERS_ERROR_KINDS } from "@modules/domain/video-renders"
import { CONTENT_ITEMS_ERROR_KINDS } from "@modules/domain/content-items"
import { CONTENT_SETTINGS_ERROR_KINDS } from "@modules/domain/content-settings"
import { CONTENT_AI_ERROR_KINDS } from "@modules/domain/content-ai"
import { CONTENT_PLANS_ERROR_KINDS } from "@modules/domain/content-plans"
import { CONTENT_PUBLISHING_ERROR_KINDS } from "@modules/domain/content-publishing"
import { CONTENT_MEDIA_ERROR_KINDS } from "@modules/domain/content-media"
import { MESSAGES_ERROR_KINDS } from "@modules/domain/messages"
import { OFFICE_ROOMS_ERROR_KINDS } from "@modules/domain/office-rooms"
import { MCP_GATEWAY_ERROR_KINDS } from "@modules/domain/mcp-gateway"
import { MCP_GATEWAY_RECEIPTS_ERROR_KINDS } from "@modules/domain/mcp-gateway-receipts"
import { MCP_ERROR_KINDS } from "@modules/integrations/mcp"
import { CUSTOMER_TURNS_ERROR_KINDS } from "@modules/domain/customer-turns"
import { AGENT_PROFILE_ERROR_KINDS } from "@modules/domain/agent-profile"
import { WORK_CHAINS_ERROR_KINDS } from "@modules/domain/work-chains"
import { THREAD_MESSAGES_ERROR_KINDS } from "@modules/domain/thread-messages"
import { THREAD_WORK_ERROR_KINDS } from "@modules/domain/thread-work"
import { WORK_THREADS_ERROR_KINDS } from "@modules/domain/work-threads"

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
    MESSAGES_ERROR_KINDS,
    OFFICE_ROOMS_ERROR_KINDS,
    MCP_ERROR_KINDS,
    MCP_GATEWAY_ERROR_KINDS,
    MCP_GATEWAY_RECEIPTS_ERROR_KINDS,
    CUSTOMER_TURNS_ERROR_KINDS,
    AGENT_PROFILE_ERROR_KINDS,
    WORK_CHAINS_ERROR_KINDS,
    WORK_THREADS_ERROR_KINDS,
    THREAD_MESSAGES_ERROR_KINDS,
    THREAD_WORK_ERROR_KINDS,
]
