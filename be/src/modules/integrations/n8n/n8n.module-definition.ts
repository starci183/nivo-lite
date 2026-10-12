import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { N8nOptions } from "./n8n.options"

/** The configurable-module base of the n8n integration. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<N8nOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
