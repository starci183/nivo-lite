import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { NativeToolsOptions } from "./native-tools.options"

/** The configurable-module base of the native-tools capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<NativeToolsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
