import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"

/** The configurable-module base of the http-security capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<HttpSecurityOptions>({ optionsInjectionToken: HTTP_SECURITY_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    HttpSecurityOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: HttpSecurityOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
