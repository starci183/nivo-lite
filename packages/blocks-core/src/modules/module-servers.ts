import type { ModuleServer } from "@nivo-lite/agent-sdk/module"
import { BOOKING_SERVER } from "./booking/template/booking.template"
import { CHATBOT_SERVER } from "./chatbot/template/chatbot.template"
import { CONTENT_SERVER } from "./content/template/content.template"
import { HIRING_SERVER } from "./hiring/template/hiring.template"
import { LEAD_GEN_SERVER } from "./lead-gen/template/lead-gen.template"
import { SALES_SERVER } from "./sales/template/sales.template"
import { VIDEO_SERVER } from "./video/template/video.template"

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
