import { messageNamed } from "../messages/catalog"
import { coreNodeViews } from "../nodes/node-lists"
import { PARAM_LABELS } from "../rows/workflow-contract-view"
import { ACCOUNTING_MESSAGES } from "../../agents/sales/ledger"
import { BOOKING_MESSAGES } from "../../agents/booking"
import { CHATBOT_MESSAGES } from "../../agents/chatbot"
import { CONTENT_MESSAGES } from "../../agents/content"
import { HIRING_MESSAGES } from "../../agents/hiring"
import { LOYALTY_MESSAGES } from "../../agents/sales/loyalty/loyalty-messages"
import { PLATFORM_MESSAGES } from "../platform"
import { SALES_MESSAGES } from "../../agents/sales"
import { VIDEO_MESSAGES } from "../../agents/video"
import type { ModuleMessages } from "./module-messages.types"

/**
 * The words of the params the workflows name (`leadId`, `orderId`), as `param.<name>` under the namespace `contract`: what the engine words a
 * contract problem with, read from the installation. `PARAM_LABELS` (the catalog keys `contractParam*`) is the one list.
 */
const CONTRACT_MESSAGES: ModuleMessages = {
    vi: Object.fromEntries(Object.entries(PARAM_LABELS).map(([name, words]) => [`param.${name}`, words.vi])),
    en: Object.fromEntries(Object.entries(PARAM_LABELS).map(([name, words]) => [`param.${name}`, words.en])),
}

/**
 * The words of the steps whose title is written as a catalog key (`{ key: "nodeSalesConsultStageTitle" }`), by step id, under the namespace
 * `node-title`: a step that writes its title in both languages needs no entry. What the engine names a step's AI calls with, read from the installation.
 */
const NODE_TITLE_MESSAGES: ModuleMessages = {
    vi: Object.fromEntries(coreNodeViews.flatMap((node) => ("key" in node.title ? [[node.id, messageNamed("vi", node.title.key) ?? node.title.key]] : []))),
    en: Object.fromEntries(coreNodeViews.flatMap((node) => ("key" in node.title ? [[node.id, messageNamed("en", node.title.key) ?? node.title.key]] : []))),
}

/**
 * The messages of every declared module, by its message namespace. The front end puts each under its namespace in the catalogue
 * of the app, which is where a spec text `{ "key": ... }` of the module is looked up.
 */
export const MODULE_MESSAGES: Readonly<Record<string, ModuleMessages>> = {
    sales: {
        vi: { ...ACCOUNTING_MESSAGES.vi, ...LOYALTY_MESSAGES.vi, ...SALES_MESSAGES.vi },
        en: { ...ACCOUNTING_MESSAGES.en, ...LOYALTY_MESSAGES.en, ...SALES_MESSAGES.en },
    },
    chatbot: CHATBOT_MESSAGES,
    platform: PLATFORM_MESSAGES,
    hiring: HIRING_MESSAGES,
    booking: BOOKING_MESSAGES,
    video: VIDEO_MESSAGES,
    content: CONTENT_MESSAGES,
    contract: CONTRACT_MESSAGES,
    "node-title": NODE_TITLE_MESSAGES,
}
