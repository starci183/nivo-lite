import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MetaInboxOptions } from "./meta-inbox.options"

/** The configurable-module base of the meta-inbox capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MetaInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
