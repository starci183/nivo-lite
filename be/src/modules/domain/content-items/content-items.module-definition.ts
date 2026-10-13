import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentItemsOptions } from "./content-items.options"

/** The configurable-module base of the content-items capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentItemsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
