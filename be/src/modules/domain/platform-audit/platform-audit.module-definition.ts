import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PlatformAuditOptions } from "./platform-audit.options"

/** The configurable-module base of the platform-audit capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PlatformAuditOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
