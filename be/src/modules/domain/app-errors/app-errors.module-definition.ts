import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AppErrorsOptions } from "./app-errors.options"

/** The configurable-module base of the app-errors capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AppErrorsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
