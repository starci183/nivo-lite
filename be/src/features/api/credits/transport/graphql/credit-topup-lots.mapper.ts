import type { CreditTopupLot } from "@modules/domain/credits"
import type { ListCreditTopupLotsRequest } from "../../application/list-credit-topup-lots.contracts"
import type { CreditTopupLotType } from "./dto/credit-topup-lot.type"

/** Maps the workspace selector to the application request. */
export const toCreditTopupLotsRequest = (workspaceId: string): ListCreditTopupLotsRequest => ({ workspaceId })

/** Maps the purchased lots to the GraphQL types. */
export const toCreditTopupLotsType = (result: ReadonlyArray<CreditTopupLot>): Array<CreditTopupLotType> =>
    result.map((lot) => ({ ...lot }))
