import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoggingOptions } from "./logging.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoggingOptions>()
