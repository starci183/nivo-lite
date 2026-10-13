import type { CustomerUpdateResult } from "../../application/update-loyalty-member.contracts"
import type { UpdateLoyaltyMemberType } from "./dto/update-loyalty-member.type"

export { toUpdateLoyaltyMemberRequest } from "@modules/domain/loyalty"

/** Maps the application result into the GraphQL fields. */
export const toUpdateLoyaltyMemberType = (result: CustomerUpdateResult): UpdateLoyaltyMemberType => ({ ...result })
