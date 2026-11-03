import { defineConfigurableModule } from "@starci/nest-kit"
import type { BookingEffectsMessageOptions } from "./booking-effects-message.options"

/** The configurable-module base of the booking-effects-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BookingEffectsMessageOptions>()
