import { defineConfigurableModule } from "@starci/nest-kit"
import type { TelegramDeliveryJobOptions } from "./telegram-delivery.options"

/** The configurable-module base of the telegram-delivery module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TelegramDeliveryJobOptions>()
