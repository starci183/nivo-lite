import { defineCapabilityModule } from "@starci/nest-kit"
import type { RetryOptions } from "./retry.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<RetryOptions>()
