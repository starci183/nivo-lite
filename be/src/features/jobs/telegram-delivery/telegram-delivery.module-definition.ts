import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TelegramDeliveryJobOptions } from "./telegram-delivery.options"

/** The configurable-module base of the telegram-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<TelegramDeliveryJobOptions>().setClassMethodName("register").build()
