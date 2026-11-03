import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublicBookingApiOptions } from "./public-booking.options"

/** The configurable-module base of the public-booking module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublicBookingApiOptions>()
