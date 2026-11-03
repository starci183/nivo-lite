import { defineConfigurableModule } from "@starci/nest-kit"
import type { ReplenishStockQueueOptions } from "./replenish-stock-queue.options"

/** The configurable-module base of the replenish-stock-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ReplenishStockQueueOptions>()
