import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { PLATFORM_ADMIN_OPTIONS } from "./platform-admin.decorators"
import type { PlatformAdminOptions } from "./platform-admin.options"

/** The configurable-module base of the platform-admin capability. */
const definition = new ConfigurableModuleBuilder<PlatformAdminOptions>({
    optionsInjectionToken: PLATFORM_ADMIN_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    PlatformAdminOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: PlatformAdminOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
