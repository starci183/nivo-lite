import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentCadenceOptions } from "./content-cadence.options"

/** Configurable registration of the content-cadence capability. */
const definition = new ConfigurableModuleBuilder<ContentCadenceOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentCadenceOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentCadenceOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
