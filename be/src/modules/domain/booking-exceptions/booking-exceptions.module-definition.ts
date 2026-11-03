import { defineCapabilityModule } from "@starci/nest-kit"
import type { BookingExceptionsOptions } from "./booking-exceptions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BookingExceptionsOptions>()
