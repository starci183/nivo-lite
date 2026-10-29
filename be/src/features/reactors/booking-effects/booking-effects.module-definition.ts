import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingEffectsOptions } from "./booking-effects.options"

/** The configurable-module base of the booking-effects module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BookingEffectsOptions>().setClassMethodName("register").build()
