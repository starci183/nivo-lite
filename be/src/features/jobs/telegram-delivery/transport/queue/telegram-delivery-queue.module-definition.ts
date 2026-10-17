import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TelegramDeliveryQueueOptions } from "./telegram-delivery-queue.options"

/** The configurable-module base of the telegram-delivery-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<TelegramDeliveryQueueOptions>().setClassMethodName("register").build()
