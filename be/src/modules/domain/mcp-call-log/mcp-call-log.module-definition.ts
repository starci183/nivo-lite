import { defineCapabilityModule } from "@starci/nest-kit"
import type { McpCallLogOptions } from "./mcp-call-log.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<McpCallLogOptions>()
