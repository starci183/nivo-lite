import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ZaloInboxOptions } from "./zalo-inbox.options"

/** The configurable-module base of the zalo-inbox capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ZaloInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
