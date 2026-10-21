import { ACCOUNTING_KNOWLEDGE } from "./accounting-knowledge.templates"
import { BOOKING_KNOWLEDGE } from "./booking-knowledge.templates"
import { CHATBOT_KNOWLEDGE } from "./chatbot-knowledge.templates"
import { CONTENT_KNOWLEDGE } from "./content-knowledge.templates"
import { CORE_KNOWLEDGE } from "./core-knowledge.templates"
import { HIRING_KNOWLEDGE } from "./hiring-knowledge.templates"
import { INVENTORY_KNOWLEDGE } from "./inventory-knowledge.templates"
import { LEAD_GEN_KNOWLEDGE } from "./lead-gen-knowledge.templates"
import { LOYALTY_KNOWLEDGE } from "./loyalty-knowledge.templates"
import { SALES_KNOWLEDGE } from "./sales-knowledge.templates"
import { SHIFTS_KNOWLEDGE } from "./shifts-knowledge.templates"
import { VIDEO_KNOWLEDGE } from "./video-knowledge.templates"
import type { NivoFile } from "./nivo-item.policy"

/** Every base knowledge file NIVO ships, by folder (`core` and the knowledge folder of each module), sorted by path. */
export const NIVO_KNOWLEDGE_FILES: ReadonlyArray<NivoFile> = [
    ...ACCOUNTING_KNOWLEDGE,
    ...BOOKING_KNOWLEDGE,
    ...CHATBOT_KNOWLEDGE,
    ...CONTENT_KNOWLEDGE,
    ...CORE_KNOWLEDGE,
    ...HIRING_KNOWLEDGE,
    ...INVENTORY_KNOWLEDGE,
    ...LEAD_GEN_KNOWLEDGE,
    ...LOYALTY_KNOWLEDGE,
    ...SALES_KNOWLEDGE,
    ...SHIFTS_KNOWLEDGE,
    ...VIDEO_KNOWLEDGE,
]
