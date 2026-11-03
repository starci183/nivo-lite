import { defineCapabilityModule } from "@starci/nest-kit"
import type { ObjectStorageOptions } from "./object-storage.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<ObjectStorageOptions>()
