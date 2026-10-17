import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ApplyBookingStatusOptions } from "./apply-booking-status.options"

/** The configurable-module base of the apply-booking-status module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ApplyBookingStatusOptions>().setClassMethodName("register").build()
