import type { ModuleServer } from "@nivo-lite/agent-sdk/module"
import { BOOKING_SERVER } from "../../agents/booking/graphs/booking.template"
import { CHATBOT_SERVER } from "../../agents/chatbot/graphs/chatbot.template"
import { CONTENT_SERVER } from "../../agents/content/graphs/content.template"
import { HIRING_SERVER } from "../../agents/hiring/graphs/hiring.template"
import { LEAD_GEN_SERVER } from "../../agents/lead-gen/graphs/lead-gen.template"
import { SALES_SERVER } from "../../agents/sales/graphs/sales.template"
import { VIDEO_SERVER } from "../../agents/video/graphs/video.template"

/**
 * The server half of every module this package declares, in no particular order (the catalogue orders by `template.order`): the
 * catalogue entry the host installs a module's agent from. A module may be listed here before its workflow templates exist. Adding a
 * module is one line here; the back end reads it through the installation only.
 */
export const MODULE_SERVERS: ReadonlyArray<ModuleServer> = [
    CHATBOT_SERVER,
    LEAD_GEN_SERVER,
    SALES_SERVER,
    BOOKING_SERVER,
    VIDEO_SERVER,
    CONTENT_SERVER,
    HIRING_SERVER,
]
