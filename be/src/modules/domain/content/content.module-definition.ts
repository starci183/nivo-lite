import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentOptions } from "./content.options"

/** The configurable-module base of the content capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContentOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
