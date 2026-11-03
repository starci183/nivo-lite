import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AiQuotaOverridesOptions } from "./ai-quota-overrides.options"

/** The configurable-module base of the ai-quota-overrides capability. */
const definition = new ConfigurableModuleBuilder<AiQuotaOverridesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AiQuotaOverridesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AiQuotaOverridesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
