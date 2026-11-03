import { defineConfigurableModule } from "@starci/nest-kit"
import type { BookingEffectsOptions } from "./booking-effects.options"

/** The configurable-module base of the booking-effects module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BookingEffectsOptions>()
