import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectionLifecycleOptions } from "./connection-lifecycle.options"

/** The configurable-module base of the connection-lifecycle capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ConnectionLifecycleOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
