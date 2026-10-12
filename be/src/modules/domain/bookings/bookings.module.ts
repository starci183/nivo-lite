import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BookingRemindersModule } from "@modules/domain/booking-reminders"
import { BookingAccessService } from "./booking-access.service"
import { BookingDeskService } from "./booking-desk.service"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
import { BookingPublicService } from "./booking-public.service"
import { BookingReservationService } from "./booking-reservation.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./bookings.module-definition"

@Module({})
/** The bookings capability over the primary Supabase PostgreSQL connection: calendar rules, the public page and the owner desk. */
export class BookingsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), BookingRemindersModule.register({})],
            providers: [
                ...(base.providers ?? []),
                BookingAccessService,
                BookingModelService,
                BookingReservationService,
                BookingPublicService,
                BookingDeskService,
                BookingOverviewService,
            ],
            exports: [BookingPublicService, BookingDeskService, BookingOverviewService],
        }
    }
}
