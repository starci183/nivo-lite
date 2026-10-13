import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { N8nRunsOptions } from "./n8n-runs.options"

/** The configurable-module base of the n8n runs capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<N8nRunsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
