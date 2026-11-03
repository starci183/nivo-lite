import { templatesOf } from "@nivo-lite/agent-sdk/module"
import { MODULE_SERVERS } from "@nivo/modules/template"
import type { ModuleDefinition } from "./modules.contracts"
import { CHATBOT_MODULE } from "./chatbot.contracts"
import { LEAD_GEN_MODULE } from "./lead-gen.contracts"
import { SALES_MODULE } from "./sales.contracts"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { SHIFTS_MODULE } from "./shifts.contracts"
import { BOOKING_MODULE } from "./booking.contracts"
import { INVENTORY_MODULE } from "./inventory.contracts"
import { VIDEO_MODULE } from "./video.contracts"
import { CONTENT_MODULE } from "./content.contracts"
import { HIRING_MODULE } from "./hiring.contracts"

/** The modules still defined in the app, until each moves into its module package. */
const APP_MODULES: ReadonlyArray<ModuleDefinition> = [
    CHATBOT_MODULE,
    LEAD_GEN_MODULE,
    SALES_MODULE,
    ACCOUNTING_MODULE,
    SHIFTS_MODULE,
    BOOKING_MODULE,
    INVENTORY_MODULE,
    VIDEO_MODULE,
    CONTENT_MODULE,
    HIRING_MODULE,
]

/** The modules of the catalogue in display order: the app's own and every module package's template, ordered by `order`. */
export const MODULE_CATALOG: ReadonlyArray<ModuleDefinition> = [...APP_MODULES, ...templatesOf(MODULE_SERVERS)].sort(
    (left, right) => left.order - right.order,
)

/** The module knowledge folders in catalogue order, shared by app composition. */
export const MODULE_KNOWLEDGE_FOLDERS: ReadonlyArray<string> = MODULE_CATALOG.map((module) => module.knowledgeFolder)
