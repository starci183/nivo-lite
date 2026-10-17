import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BankFeedDeliveryJobOptions } from "./bank-feed-delivery.options"

/** The configurable-module base of the bank-feed-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BankFeedDeliveryJobOptions>().setClassMethodName("register").build()
