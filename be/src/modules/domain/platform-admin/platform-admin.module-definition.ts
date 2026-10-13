import { ConfigurableModuleBuilder } from "@nestjs/common"
import { PLATFORM_ADMIN_OPTIONS } from "./platform-admin.decorators"
import type { PlatformAdminOptions } from "./platform-admin.options"

/** The configurable-module base of the platform-admin capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PlatformAdminOptions>({
    optionsInjectionToken: PLATFORM_ADMIN_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
