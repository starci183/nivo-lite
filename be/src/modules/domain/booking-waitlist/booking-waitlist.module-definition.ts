import { defineCapabilityModule } from "@starci/nest-kit"
import type { BookingWaitlistOptions } from "./booking-waitlist.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BookingWaitlistOptions>()
