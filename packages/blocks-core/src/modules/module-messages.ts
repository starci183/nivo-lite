import { LOYALTY_MESSAGES } from "./loyalty"
import type { ModuleMessages } from "./module-messages.types"

/**
 * The messages of every declared module, by its message namespace. The front end puts each under its namespace in the catalogue
 * of the app, which is where a spec text `{ "key": ... }` of the module is looked up.
 */
export const MODULE_MESSAGES: Readonly<Record<string, ModuleMessages>> = { loyalty: LOYALTY_MESSAGES }
