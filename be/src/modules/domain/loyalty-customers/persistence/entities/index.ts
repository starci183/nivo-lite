import { LoyaltyCustomerEntity } from "./loyalty-customer.entity"

export { LoyaltyCustomerEntity }

/** The entities the loyalty-customers capability owns, collected by the database module. */
export const loyaltyCustomersEntities = [LoyaltyCustomerEntity] as const
