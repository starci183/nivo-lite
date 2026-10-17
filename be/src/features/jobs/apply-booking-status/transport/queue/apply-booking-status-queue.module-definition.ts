import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ApplyBookingStatusQueueOptions } from "./apply-booking-status-queue.options"

/** The configurable-module base of the apply-booking-status-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ApplyBookingStatusQueueOptions>().setClassMethodName("register").build()
