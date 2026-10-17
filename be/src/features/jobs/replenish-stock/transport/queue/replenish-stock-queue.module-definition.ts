import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ReplenishStockQueueOptions } from "./replenish-stock-queue.options"

/** The configurable-module base of the replenish-stock-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ReplenishStockQueueOptions>().setClassMethodName("register").build()
