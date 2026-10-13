import type { ModuleDefinition } from "./modules.contracts"
import { CHATBOT_MODULE } from "./chatbot.contracts"
import { LEAD_GEN_MODULE } from "./lead-gen.contracts"
import { SALES_MODULE } from "./sales.contracts"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { SHIFTS_MODULE } from "./shifts.contracts"
import { BOOKING_MODULE } from "./booking.contracts"
import { INVENTORY_MODULE } from "./inventory.contracts"
import { LOYALTY_MODULE } from "./loyalty.contracts"
import { VIDEO_MODULE } from "./video.contracts"
import { CONTENT_MODULE } from "./content.contracts"
import { HIRING_MODULE } from "./hiring.contracts"

/** The modules of the catalogue in display order. */
export const MODULE_CATALOG: ReadonlyArray<ModuleDefinition> = [
    CHATBOT_MODULE,
    LEAD_GEN_MODULE,
    SALES_MODULE,
    ACCOUNTING_MODULE,
    SHIFTS_MODULE,
    BOOKING_MODULE,
    INVENTORY_MODULE,
    LOYALTY_MODULE,
    VIDEO_MODULE,
    CONTENT_MODULE,
    HIRING_MODULE,
]
