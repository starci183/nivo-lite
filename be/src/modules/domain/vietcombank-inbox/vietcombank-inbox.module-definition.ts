import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VietcombankInboxOptions } from "./vietcombank-inbox.options"

/** The configurable-module base of the vietcombank-inbox capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VietcombankInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
