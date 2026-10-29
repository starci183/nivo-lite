import { LoyaltyOtpEntity } from "./loyalty-otp.entity"

export { LoyaltyOtpEntity }

/** The entities the loyalty-otps capability owns, collected by the database module. */
export const loyaltyOtpsEntities = [LoyaltyOtpEntity] as const
