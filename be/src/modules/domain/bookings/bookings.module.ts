import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BookingExceptionsModule } from "@modules/domain/booking-exceptions"
import { BookingHoursModule } from "@modules/domain/booking-hours"
import { BookingResourcesModule } from "@modules/domain/booking-resources"
import { BookingSettingsModule } from "@modules/domain/booking-settings"
import { BookingWaitlistModule } from "@modules/domain/booking-waitlist"
import { BookingRemindersModule } from "@modules/domain/booking-reminders"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { BookingDeskService } from "./booking-desk.service"
import { BookingBoardService } from "./booking-board.service"
import { BookingSetupService } from "./booking-setup.service"
import { BookingEffectsService } from "./booking-effects.service"
import { BookingModelService } from "./booking-model.service"
import { BookingNoticesService } from "./booking-notices.service"
import { BookingOverviewService } from "./booking-overview.service"
import { BookingChatLookupService } from "./booking-chat-lookup.service"
import { BookingPublicService } from "./booking-public.service"
import { BookingReservationService } from "./booking-reservation.service"
import { BOOKINGS_NOTIFIER } from "./bookings.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./bookings.module-definition"

@Module({})
/** The bookings capability over the primary PostgreSQL connection: calendar rules, the public page and the owner desk. */
export class BookingsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app, with the delivery of booking notices. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const waitlist = BookingWaitlistModule.register({})
        const reminders = BookingRemindersModule.register({})
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                reminders,
                BookingResourcesModule.register({}),
                BookingHoursModule.register({}),
                BookingExceptionsModule.register({}),
                BookingSettingsModule.register({}),
                waitlist,
            ],
            providers: [
                ...(base.providers ?? []),
                { provide: BOOKINGS_NOTIFIER, useClass: options.notifier },
                { provide: INBOX, useClass: InboxService },
                BookingModelService,
                BookingNoticesService,
                BookingReservationService,
                BookingPublicService,
                BookingDeskService,
                BookingOverviewService,
                BookingEffectsService,
                BookingBoardService,
                BookingSetupService,
                BookingChatLookupService,
            ],
            exports: [
                BOOKINGS_NOTIFIER,
                reminders,
                BookingNoticesService,
                BookingChatLookupService,
                waitlist,
                BookingPublicService,
                BookingDeskService,
                BookingOverviewService,
                BookingEffectsService,
                BookingBoardService,
                BookingSetupService,
            ],
        }
    }
}
