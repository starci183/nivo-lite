import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BankFeedDeliveryQueueOptions } from "./bank-feed-delivery-queue.options"

/** The configurable-module base of the bank-feed-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BankFeedDeliveryQueueOptions>().setClassMethodName("register").build()
