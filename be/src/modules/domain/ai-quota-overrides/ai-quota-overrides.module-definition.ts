import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AiQuotaOverridesOptions } from "./ai-quota-overrides.options"

/** The configurable-module base of the ai-quota-overrides capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AiQuotaOverridesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
