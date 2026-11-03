import { defineCapabilityModule } from "@starci/nest-kit"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<HttpSecurityOptions>({
    optionsInjectionToken: HTTP_SECURITY_OPTIONS,
})
