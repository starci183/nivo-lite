import { defineCapabilityModule } from "@starci/nest-kit"
import type { BookingSettingsOptions } from "./booking-settings.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BookingSettingsOptions>()
