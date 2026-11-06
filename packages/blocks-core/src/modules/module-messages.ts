import { ACCOUNTING_MESSAGES } from "./accounting"
import { CHATBOT_MESSAGES } from "./chatbot"
import { LOYALTY_MESSAGES } from "./loyalty"
import { PLATFORM_MESSAGES } from "./platform"
import { SALES_MESSAGES } from "./sales"
import type { ModuleMessages } from "./module-messages.types"

/**
 * The messages of every declared module, by its message namespace. The front end puts each under its namespace in the catalogue
 * of the app, which is where a spec text `{ "key": ... }` of the module is looked up.
 */
export const MODULE_MESSAGES: Readonly<Record<string, ModuleMessages>> = {
    loyalty: LOYALTY_MESSAGES,
    sales: SALES_MESSAGES,
    chatbot: CHATBOT_MESSAGES,
    accounting: ACCOUNTING_MESSAGES,
    platform: PLATFORM_MESSAGES,
}
