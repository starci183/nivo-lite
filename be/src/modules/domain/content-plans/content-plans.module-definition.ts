import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentPlansOptions } from "./content-plans.options"

/** Configurable registration base with global scope selected by the root. */
const definition = new ConfigurableModuleBuilder<ContentPlansOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentPlansOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentPlansOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
