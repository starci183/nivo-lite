import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingServicesOptions } from "./booking-services.options"

/** The configurable service catalogue capability; its importer decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingServicesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
