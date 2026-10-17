import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublicBookingApiOptions } from "./public-booking.options"

/** The configurable-module base of the public-booking module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PublicBookingApiOptions>().setClassMethodName("register").build()
