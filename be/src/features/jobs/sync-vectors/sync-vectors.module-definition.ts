import { defineConfigurableModule } from "@starci/nest-kit"
import type { SyncVectorsOptions } from "./sync-vectors.options"

/** The configurable-module base of the sync-vectors module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SyncVectorsOptions>()
