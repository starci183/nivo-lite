import { defineConfigurableModule } from "@starci/nest-kit"
import type { BookingGraphqlOptions } from "./booking-graphql.options"

/** The configurable-module base of the booking-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BookingGraphqlOptions>()
