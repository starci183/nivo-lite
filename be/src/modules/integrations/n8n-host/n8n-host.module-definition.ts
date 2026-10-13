import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { N8nHostOptions } from "./n8n-host.options"

/** The configurable-module base of the n8n host integration. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<N8nHostOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
