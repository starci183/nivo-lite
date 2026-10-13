import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingExceptionsOptions } from "./booking-exceptions.options"

/** Configurable-module base for the booking calendar exceptions capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingExceptionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
