import { Injectable, type OnModuleInit } from "@nestjs/common"
import { CalendarRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { GCAL_SANDBOX_CATALOGUE } from "./google-calendar-sandbox.catalogue"
import { GoogleCalendarSandboxService } from "./google-calendar-sandbox-calendar.service"
import { GoogleCalendarService } from "./google-calendar.service"

@Injectable()
/**
 * Hands what Google Calendar can do for core to the registry that asks for it, once, when the app starts: the calendar purpose, with its
 * live port and its sandbox twin, and the hardcoded sandbox catalogue (added to the Google account's other cases: one provider key).
 */
export class GoogleCalendarProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly calendars: CalendarRegistryService,
        private readonly calendar: GoogleCalendarService,
        private readonly calendarSandbox: GoogleCalendarSandboxService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the calendar to its registry, live and sandbox, and registers the catalogue. */
    onModuleInit(): void {
        this.calendars.register({ live: this.calendar, sandbox: this.calendarSandbox })
        const ids = new Set(GCAL_SANDBOX_CATALOGUE.cases.map((one) => one.id))
        const others = this.catalogues.casesOf(GCAL_SANDBOX_CATALOGUE.provider).filter((one) => !ids.has(one.id))
        this.catalogues.register({ provider: GCAL_SANDBOX_CATALOGUE.provider, cases: [...others, ...GCAL_SANDBOX_CATALOGUE.cases] })
    }
}
