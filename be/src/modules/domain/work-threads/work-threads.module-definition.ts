import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkThreadsOptions } from "./work-threads.options"

/** The configurable-module base of the work-threads capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkThreadsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
