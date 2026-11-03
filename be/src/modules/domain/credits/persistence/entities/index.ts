import { CreditPackEntity } from "./credit-pack.entity"
import { CreditPackPurchaseEntity } from "./credit-pack-purchase.entity"
import { CreditTopupEntity } from "./credit-topup.entity"
import { CreditTopupDrawEntity } from "./credit-topup-draw.entity"

export { CreditPackEntity, CreditPackPurchaseEntity, CreditTopupDrawEntity, CreditTopupEntity }

/** The entities the credits capability owns, for the app's connection. */
export const creditsEntities: readonly [
    typeof CreditPackEntity,
    typeof CreditPackPurchaseEntity,
    typeof CreditTopupEntity,
    typeof CreditTopupDrawEntity,
] = [CreditPackEntity, CreditPackPurchaseEntity, CreditTopupEntity, CreditTopupDrawEntity] as const
