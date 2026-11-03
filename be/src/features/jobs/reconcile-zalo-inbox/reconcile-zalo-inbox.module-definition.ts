import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReconcileZaloInboxOptions } from "./reconcile-zalo-inbox.options"

/** The configurable-module base of the reconcile-zalo-inbox module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReconcileZaloInboxOptions>()
