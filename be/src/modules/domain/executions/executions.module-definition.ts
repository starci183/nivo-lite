import { defineCapabilityModule } from "@starci/nest-kit"
import type { ExecutionsOptions } from "./executions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ExecutionsOptions>()
