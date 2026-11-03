import { defineConfigurableModule } from "@starci/nest-kit"
import type { BankFeedDeliveryQueueOptions } from "./bank-feed-delivery-queue.options"

/** The configurable-module base of the bank-feed-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BankFeedDeliveryQueueOptions>()
