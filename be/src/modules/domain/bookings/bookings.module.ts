import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BookingRemindersModule } from "@modules/domain/booking-reminders"
import { BookingDeskService } from "./booking-desk.service"
import { BookingEffectsService } from "./booking-effects.service"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
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
        return {
            ...base,
            imports: [...(base.imports ?? []), BookingRemindersModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: BOOKINGS_NOTIFIER, useValue: options.notifier ?? NO_NOTICE },
                BookingModelService,
                BookingReservationService,
                BookingPublicService,
                BookingDeskService,
                BookingOverviewService,
                BookingEffectsService,
            ],
            exports: [BookingPublicService, BookingDeskService, BookingOverviewService, BookingEffectsService],
        }
    }
}
