import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentOptions } from "./content.options"

/** The configurable-module base of the content capability. */
const definition = new ConfigurableModuleBuilder<ContentOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
