import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MetaCommentsOptions } from "./meta-comments.options"

/** Configurable-module base for the meta-comments capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MetaCommentsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
