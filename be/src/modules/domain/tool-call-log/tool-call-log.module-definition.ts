import { defineCapabilityModule } from "@starci/nest-kit"
import type { ToolCallLogOptions } from "./tool-call-log.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ToolCallLogOptions>()
