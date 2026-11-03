import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublicBookingGraphqlOptions } from "./public-booking-graphql.options"

/** The configurable-module base of the public-booking-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublicBookingGraphqlOptions>()
