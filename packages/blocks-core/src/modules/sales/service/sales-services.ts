import type { AnyServiceDefinition } from "@nivo-lite/agent-sdk/service"
import { SALES_TOOL_DECLARATIONS_SERVICE } from "./sales-tools.declarations"
import { SALES_TOOLS_SERVICE } from "./sales-tools.service"

/** The services the sales module ships to the engine: its tool declarations and the tools' business. */
export const SALES_SERVICES: ReadonlyArray<AnyServiceDefinition> = [
    SALES_TOOL_DECLARATIONS_SERVICE,
    SALES_TOOLS_SERVICE,
]
