import type { CreditPack } from "@modules/domain/credits"
import type { CreditPackType } from "./dto/credit-pack.type"

/** Maps the catalogue to the GraphQL types. */
export const toCreditPacksType = (result: ReadonlyArray<CreditPack>): Array<CreditPackType> =>
    result.map((pack) => ({ ...pack }))
