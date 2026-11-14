import { Injectable, type OnModuleInit } from "@nestjs/common"
import { CalendarRegistryService } from "@modules/domain/provider-registry"
import { GoogleCalendarService } from "./google-calendar.service"

@Injectable()
/** Hands what Google Calendar can do for core to the registry that asks for it, once, when the app starts: the calendar purpose. */
export class GoogleCalendarProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly calendars: CalendarRegistryService,
        private readonly calendar: GoogleCalendarService,
    ) {}

    /** Hands the calendar to its registry. */
    onModuleInit(): void {
        this.calendars.register(this.calendar)
    }
}
