import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ReconcileBankCreditOptions } from "./reconcile-bank-credit.options"

/** The configurable-module base of the reconcile-bank-credit module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ReconcileBankCreditOptions>().setClassMethodName("register").build()
