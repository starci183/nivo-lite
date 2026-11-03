import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentItemsOptions } from "./content-items.options"

/** The configurable-module base of the content-items capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ContentItemsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentItemsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentItemsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
