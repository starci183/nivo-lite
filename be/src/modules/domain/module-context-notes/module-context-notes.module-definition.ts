import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContextNotesOptions } from "./module-context-notes.options"

/** The configurable-module base of the context-notes capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContextNotesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
