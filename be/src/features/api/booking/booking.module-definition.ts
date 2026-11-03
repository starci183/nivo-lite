import { defineConfigurableModule } from "@starci/nest-kit"
import type { BookingApiOptions } from "./booking.options"

/** The configurable-module base of the booking module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BookingApiOptions>()
