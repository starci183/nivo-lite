import { defineCapabilityModule } from "@starci/nest-kit"
import type { McpToolGrantsOptions } from "./mcp-tool-grants.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<McpToolGrantsOptions>()
