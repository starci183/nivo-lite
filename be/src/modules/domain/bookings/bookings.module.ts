import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BookingExceptionsModule } from "@modules/domain/booking-exceptions"
import { BookingHoursModule } from "@modules/domain/booking-hours"
import { BookingResourcesModule } from "@modules/domain/booking-resources"
import { BookingServicesModule } from "@modules/domain/booking-services"
import { BookingSettingsModule } from "@modules/domain/booking-settings"
import { BookingWaitlistModule } from "@modules/domain/booking-waitlist"
import { BookingRemindersModule } from "@modules/domain/booking-reminders"
import { BookingDeskService } from "./booking-desk.service"
import { BookingBoardService } from "./booking-board.service"
import { BookingSetupService } from "./booking-setup.service"
import { BookingEffectsService } from "./booking-effects.service"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
import { BookingChatLookupService } from "./booking-chat-lookup.service"
import { BookingPublicService } from "./booking-public.service"
import { BookingReservationService } from "./booking-reservation.service"
import type { BookingNotifier } from "./bookings.contracts"
import { BOOKINGS_NOTIFIER } from "./bookings.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./bookings.module-definition"

/** Notifier used until the app root provides one: nothing reaches the customer, the other effects are unaffected. */
const NO_NOTICE: BookingNotifier = { notify: () => Promise.resolve(false) }

@Module({})
/** The bookings capability over the primary Supabase PostgreSQL connection: calendar rules, the public page and the owner desk. */
export class BookingsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app, with the delivery of booking notices. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const waitlist = BookingWaitlistModule.register({})
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                BookingRemindersModule.register({}),
                BookingServicesModule.register({}),
                BookingResourcesModule.register({}),
                BookingHoursModule.register({}),
                BookingExceptionsModule.register({}),
                BookingSettingsModule.register({}),
                waitlist,
            ],
            providers: [
                ...(base.providers ?? []),
                { provide: BOOKINGS_NOTIFIER, useValue: options.notifier ?? NO_NOTICE },
                BookingModelService,
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
