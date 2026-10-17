import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ReconcileBankCreditQueueOptions } from "./reconcile-bank-credit-queue.options"

/** The configurable-module base of the reconcile-bank-credit-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ReconcileBankCreditQueueOptions>().setClassMethodName("register").build()
