import { defineConfigurableModule } from "@starci/nest-kit"
import type { TelegramDeliveryQueueOptions } from "./telegram-delivery-queue.options"

/** The configurable-module base of the telegram-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TelegramDeliveryQueueOptions>()
