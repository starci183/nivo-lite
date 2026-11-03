import { defineConfigurableModule } from "@starci/nest-kit"
import type { StorageCliOptions } from "./storage.options"

/** The configurable-module base of the storage cli module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<StorageCliOptions>()
