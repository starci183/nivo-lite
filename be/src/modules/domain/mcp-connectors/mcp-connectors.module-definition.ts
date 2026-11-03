import { defineCapabilityModule } from "@starci/nest-kit"
import type { McpConnectorsOptions } from "./mcp-connectors.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<McpConnectorsOptions>()
