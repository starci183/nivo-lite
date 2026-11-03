import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReconcileZaloInboxQueueOptions } from "./reconcile-zalo-inbox-queue.options"

/** The configurable-module base of the reconcile-zalo-inbox-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReconcileZaloInboxQueueOptions>()
