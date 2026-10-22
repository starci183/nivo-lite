import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MemberGrantsOptions } from "./member-grants.options"

/** The configurable-module base of the member-grants capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MemberGrantsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
