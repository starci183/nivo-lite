import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OpenclawOptions } from "./openclaw.options"

/** The configurable-module base of the OpenClaw integration. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OpenclawOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
