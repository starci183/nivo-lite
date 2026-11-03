import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { MetaCommentsOptions } from "./meta-comments.options"

/** Configurable-module base for the meta-comments capability. */
const definition = new ConfigurableModuleBuilder<MetaCommentsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    MetaCommentsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: MetaCommentsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
