import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingHoursOptions } from "./booking-hours.options"

/** Configurable-module base for the weekly booking hours capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingHoursOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
