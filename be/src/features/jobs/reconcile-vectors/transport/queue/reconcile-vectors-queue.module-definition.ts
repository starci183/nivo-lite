import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReconcileVectorsQueueOptions } from "./reconcile-vectors-queue.options"

/** The configurable-module base of the reconcile-vectors-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReconcileVectorsQueueOptions>()
