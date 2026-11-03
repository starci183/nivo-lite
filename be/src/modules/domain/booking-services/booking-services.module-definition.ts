import { defineCapabilityModule } from "@starci/nest-kit"
import type { BookingServicesOptions } from "./booking-services.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BookingServicesOptions>()
