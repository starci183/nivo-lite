import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingGraphqlOptions } from "./booking-graphql.options"

/** The configurable-module base of the booking-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BookingGraphqlOptions>().setClassMethodName("register").build()
