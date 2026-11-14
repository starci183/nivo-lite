import { defineCapabilityModule } from "@starci/nest-kit"
import type { GoogleCalendarProviderOptions } from "./google-calendar-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<GoogleCalendarProviderOptions>()
