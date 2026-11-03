import { defineCapabilityModule } from "@starci/nest-kit"
import type { BookingsOptions } from "./bookings.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BookingsOptions>()
