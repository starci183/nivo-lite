import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingWaitlistOptions } from "./booking-waitlist.options"

/** The configurable-module base of the booking waitlist; the importer decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingWaitlistOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
