import type { DynamicModule } from "@nestjs/common"
import { BookingGraphqlModule } from "@features/api/booking"
import { LoyaltyGraphqlModule } from "@features/api/loyalty"
import { LoyaltyTillHttpModule } from "@features/api/loyalty-till"
import { PublicBookingGraphqlModule } from "@features/api/public-booking"
import { PublicLoyaltyGraphqlModule } from "@features/api/public-loyalty"
import { LoyaltyCampaignsModule } from "@modules/domain/loyalty-campaigns"
import { LoyaltyCustomerLinksModule } from "@modules/domain/loyalty-customer-links"
import { LoyaltyCustomersModule } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerModule } from "@modules/domain/loyalty-ledger"
import { LoyaltyOtpsModule } from "@modules/domain/loyalty-otps"
import { LoyaltyProgramsModule } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsModule } from "@modules/domain/loyalty-rewards"
import { LoyaltyCodeDeliveryService, LoyaltyModule } from "@modules/domain/loyalty"
import type { ApiOptions } from "../api.options"
/** The loyalty area of the API, in registration order. */
export const loyaltyModules = (options: ApiOptions): Array<DynamicModule> => [
    LoyaltyProgramsModule.register({ isGlobal: true }),
    LoyaltyCustomersModule.register({ isGlobal: true }),
    LoyaltyCustomerLinksModule.register({ isGlobal: true }),
    LoyaltyRewardsModule.register({ isGlobal: true }),
    LoyaltyLedgerModule.register({ isGlobal: true }),
    LoyaltyCampaignsModule.register({ isGlobal: true }),
    LoyaltyOtpsModule.register({ isGlobal: true, ...options.loyaltyOtps }),
    LoyaltyModule.register({ isGlobal: true, delivery: LoyaltyCodeDeliveryService }),
    PublicBookingGraphqlModule.register({}),
    BookingGraphqlModule.register({}),
    PublicLoyaltyGraphqlModule.register({}),
    LoyaltyGraphqlModule.register({}),
    LoyaltyTillHttpModule.register({}),
]
