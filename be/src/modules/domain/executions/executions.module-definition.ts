import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ExecutionsOptions } from "./executions.options"

/** The configurable-module base of the executions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ExecutionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
