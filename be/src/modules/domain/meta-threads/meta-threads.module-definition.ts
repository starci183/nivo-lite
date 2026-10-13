import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MetaThreadsOptions } from "./meta-threads.options"

/** Configurable-module base for the meta-threads capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MetaThreadsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
