import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReconcileBankFeedQueueOptions } from "./reconcile-bank-feed-queue.options"

/** The configurable-module base of the reconcile-bank-feed-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReconcileBankFeedQueueOptions>()
