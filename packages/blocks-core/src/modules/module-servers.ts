import type { ModuleServer } from "@nivo-lite/agent-sdk/module"
import { LOYALTY_SERVER } from "./loyalty/template"

/**
 * The server half of every module built on the SDK, in no particular order (the catalogue orders by `template.order`). Adding a module
 * is one line here; the back end reads nothing else of a module.
 */
export const MODULE_SERVERS: ReadonlyArray<ModuleServer> = [LOYALTY_SERVER]
