import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { PlatformAuditOptions } from "./platform-audit.options"

/** The configurable-module base of the platform-audit capability. */
const definition = new ConfigurableModuleBuilder<PlatformAuditOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    PlatformAuditOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: PlatformAuditOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
