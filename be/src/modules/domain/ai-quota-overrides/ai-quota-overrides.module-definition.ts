import { defineCapabilityModule } from "@starci/nest-kit"
import type { AiQuotaOverridesOptions } from "./ai-quota-overrides.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AiQuotaOverridesOptions>()
