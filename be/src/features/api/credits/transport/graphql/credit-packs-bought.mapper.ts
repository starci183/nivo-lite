import type { CreditPackPurchase } from "@modules/domain/credits"
import type { ListCreditPacksBoughtRequest } from "../../application/list-credit-packs-bought.contracts"
import type { CreditPackPurchaseType } from "./dto/credit-pack-purchase.type"

/** Maps the workspace selector to the application request. */
export const toCreditPacksBoughtRequest = (workspaceId: string): ListCreditPacksBoughtRequest => ({ workspaceId })

/** Maps the purchases to the GraphQL types. */
export const toCreditPacksBoughtType = (result: ReadonlyArray<CreditPackPurchase>): Array<CreditPackPurchaseType> =>
    result.map((purchase) => ({ ...purchase }))
