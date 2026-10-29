import { LoyaltyProgramEntity } from "./loyalty-program.entity"

export { LoyaltyProgramEntity }

/** The entities the loyalty-programs capability owns, collected by the database module. */
export const loyaltyProgramsEntities = [LoyaltyProgramEntity] as const
