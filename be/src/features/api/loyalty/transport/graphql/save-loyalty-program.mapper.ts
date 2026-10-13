import type { LoyaltyProgram } from "../../application/save-loyalty-program.contracts"
import type { LoyaltyProgramType } from "./dto/loyalty-program.type"

export { toSaveLoyaltyProgramRequest } from "@modules/domain/loyalty"

/** Maps the application result into the GraphQL fields. */
export const toSaveLoyaltyProgramType = (result: LoyaltyProgram): LoyaltyProgramType => ({ ...result })
