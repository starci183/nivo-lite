import { Module, type DynamicModule } from "@nestjs/common"
import { GoogleCalendarClient } from "./google-calendar.client"
import { GOOGLE_CALENDAR } from "./google-calendar.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./google-calendar.module-definition"

@Module({})
/** Provides the Google Calendar client. */
export class GoogleCalendarModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls Calendar. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: GOOGLE_CALENDAR, useClass: GoogleCalendarClient }],
            exports: [GOOGLE_CALENDAR],
        }
    }
}
