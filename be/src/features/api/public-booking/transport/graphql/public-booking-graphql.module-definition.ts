import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublicBookingGraphqlOptions } from "./public-booking-graphql.options"

/** The configurable-module base of the public-booking-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PublicBookingGraphqlOptions>().setClassMethodName("register").build()
