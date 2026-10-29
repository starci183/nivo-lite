import type { DynamicModule } from "@nestjs/common"
import { BookingGraphqlModule } from "@features/api/booking"
import { LoyaltyGraphqlModule } from "@features/api/loyalty"
import { LoyaltyTillHttpModule } from "@features/api/loyalty-till"
import { PublicBookingGraphqlModule } from "@features/api/public-booking"
import { PublicLoyaltyGraphqlModule } from "@features/api/public-loyalty"
import {
    LOYALTY_CAMPAIGNS_ERROR_KINDS,
    LOYALTY_CAMPAIGNS_MESSAGES,
    LoyaltyCampaignsModule,
} from "@modules/domain/loyalty-campaigns"
import { LoyaltyCustomerLinksModule } from "@modules/domain/loyalty-customer-links"
import { LoyaltyCustomersModule } from "@modules/domain/loyalty-customers"
import {
    LOYALTY_LEDGER_ERROR_KINDS,
    LOYALTY_LEDGER_MESSAGES,
    LoyaltyLedgerModule,
} from "@modules/domain/loyalty-ledger"
import { LOYALTY_OTPS_ERROR_KINDS, LOYALTY_OTPS_MESSAGES, LoyaltyOtpsModule } from "@modules/domain/loyalty-otps"
import { LoyaltyProgramsModule } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsModule } from "@modules/domain/loyalty-rewards"
import {
    LOYALTY_ERROR_KINDS,
    LOYALTY_MESSAGES,
    LoyaltyCodeDeliveryService,
    LoyaltyModule,
} from "@modules/domain/loyalty"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
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

/** The error kinds of the capabilities this group registers, in registration order. */
export const loyaltyErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    LOYALTY_CAMPAIGNS_ERROR_KINDS,
    LOYALTY_ERROR_KINDS,
    LOYALTY_LEDGER_ERROR_KINDS,
    LOYALTY_OTPS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const loyaltyMessages: ReadonlyArray<MessageBundle> = [
    LOYALTY_CAMPAIGNS_MESSAGES,
    LOYALTY_LEDGER_MESSAGES,
    LOYALTY_MESSAGES,
    LOYALTY_OTPS_MESSAGES,
]
