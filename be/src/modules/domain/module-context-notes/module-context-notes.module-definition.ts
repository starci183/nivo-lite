import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContextNotesOptions } from "./module-context-notes.options"

/** The configurable-module base of the context-notes capability. */
const definition = new ConfigurableModuleBuilder<ContextNotesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContextNotesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContextNotesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
