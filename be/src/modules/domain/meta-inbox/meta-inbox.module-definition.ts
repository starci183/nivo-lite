import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { MetaInboxOptions } from "./meta-inbox.options"

/** The configurable-module base of the meta-inbox capability. */
const definition = new ConfigurableModuleBuilder<MetaInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    MetaInboxOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: MetaInboxOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
