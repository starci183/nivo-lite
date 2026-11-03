import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReconcileBankFeedOptions } from "./reconcile-bank-feed.options"

/** The configurable-module base of the reconcile-bank-feed module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReconcileBankFeedOptions>()
