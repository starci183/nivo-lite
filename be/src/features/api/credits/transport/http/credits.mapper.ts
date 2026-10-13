import type { PayableOrder } from "@modules/domain/billing"
import type { CreditsOverview, UpgradeOrder } from "@modules/domain/credits"
import type { CreditOrderResponse } from "./dto/credit-order.response"
import type { CreditsOverviewResponse } from "./dto/credits-overview.response"
import type { UpgradeOrderResponse } from "./dto/upgrade-order.response"

/** Maps the credits overview to the HTTP response (the same shape). */
export const toCreditsOverviewResponse = (result: CreditsOverview): CreditsOverviewResponse => result

/** Maps a payable order to the HTTP response (the same shape). */
export const toCreditOrderResponse = (result: PayableOrder): CreditOrderResponse => result

/** Maps an upgrade order to the HTTP response (the same shape: the order and the figures it froze). */
export const toUpgradeOrderResponse = (result: UpgradeOrder): UpgradeOrderResponse => result
