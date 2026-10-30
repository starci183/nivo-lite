import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ObjectStorageOptions } from "./storage.options"

/** The configurable-module base of the storage integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE, MODULE_OPTIONS_TOKEN } =
    new ConfigurableModuleBuilder<ObjectStorageOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
