import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingResourcesOptions } from "./booking-resources.options"

/** The configurable resource capability; its importer decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingResourcesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
