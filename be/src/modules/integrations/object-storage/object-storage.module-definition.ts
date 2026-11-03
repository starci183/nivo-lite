import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ObjectStorageOptions } from "./object-storage.options"

/** The configurable-module base of the storage integration; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ObjectStorageOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ObjectStorageOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ObjectStorageOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
