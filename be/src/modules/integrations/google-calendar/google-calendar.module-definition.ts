import { defineCapabilityModule } from "@starci/nest-kit"
import { GOOGLE_CALENDAR_OPTIONS } from "./google-calendar.decorators"
import type { GoogleCalendarOptions } from "./google-calendar.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<GoogleCalendarOptions>({
    optionsInjectionToken: GOOGLE_CALENDAR_OPTIONS,
})
