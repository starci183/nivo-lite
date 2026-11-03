import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { DATABASE_OPTIONS } from "./database.port"
import type { DatabaseOptions } from "./database.options"

/** The configurable-module base of the database capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<DatabaseOptions>({
    optionsInjectionToken: DATABASE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({
        ...definition,
        global: extras.isGlobal,
    }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    DatabaseOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: DatabaseOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
