import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ApiCredentialsOptions } from "./api-credentials.options"

/** The configurable base for app credential admission. */
const definition = new ConfigurableModuleBuilder<ApiCredentialsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ApiCredentialsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ApiCredentialsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
