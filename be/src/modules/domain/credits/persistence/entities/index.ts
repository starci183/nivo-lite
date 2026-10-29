import { CreditPackEntity } from "./credit-pack.entity"
import { CreditPackPurchaseEntity } from "./credit-pack-purchase.entity"
import { CreditTopupEntity } from "./credit-topup.entity"

export { CreditPackEntity, CreditPackPurchaseEntity, CreditTopupEntity }

/** The entities the credits capability owns, for the app's connection. */
export const creditsEntities = [CreditPackEntity, CreditPackPurchaseEntity, CreditTopupEntity] as const
