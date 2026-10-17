import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ReplenishStockOptions } from "./replenish-stock.options"

/** The configurable-module base of the replenish-stock module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ReplenishStockOptions>().setClassMethodName("register").build()
