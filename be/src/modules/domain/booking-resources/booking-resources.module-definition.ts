import { defineCapabilityModule } from "@starci/nest-kit"
import type { BookingResourcesOptions } from "./booking-resources.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BookingResourcesOptions>()
