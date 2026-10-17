import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingApiOptions } from "./booking.options"

/** The configurable-module base of the booking module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BookingApiOptions>().setClassMethodName("register").build()
