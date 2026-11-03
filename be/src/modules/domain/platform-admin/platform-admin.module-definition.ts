import { defineCapabilityModule } from "@starci/nest-kit"
import { PLATFORM_ADMIN_OPTIONS } from "./platform-admin.decorators"
import type { PlatformAdminOptions } from "./platform-admin.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PlatformAdminOptions>({
    optionsInjectionToken: PLATFORM_ADMIN_OPTIONS,
})
