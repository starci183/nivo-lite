import { Module, type DynamicModule } from "@nestjs/common"
import { GoogleCalendarCredentialService } from "./google-calendar-credential.service"
import { GoogleCalendarProviderRegistrationService } from "./google-calendar-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./google-calendar-provider.module-definition"
import { GoogleCalendarService } from "./google-calendar.service"

const PROVIDERS = [GoogleCalendarCredentialService, GoogleCalendarService]

@Module({})
/**
 * Everything Google Calendar-specific that core asks a provider for: the generic calendar purpose (`nivo.tool.calendar.*`), served by the
 * Google account. The app imports the Calendar integration (`GoogleCalendarModule`) and the Google connections (which must export
 * `GoogleTokensService`) beside it.
 */
export class GoogleCalendarProviderModule extends ConfigurableModuleClass {
    /** Registers the app's Google Calendar provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, GoogleCalendarProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
