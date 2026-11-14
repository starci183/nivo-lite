import { defineCapabilityModule } from "@starci/nest-kit"
import type { ToolReceiptsOptions } from "./tool-receipts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ToolReceiptsOptions>()
