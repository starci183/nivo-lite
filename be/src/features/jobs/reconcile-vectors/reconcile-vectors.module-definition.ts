import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReconcileVectorsOptions } from "./reconcile-vectors.options"

/** The configurable-module base of the reconcile-vectors module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReconcileVectorsOptions>()
