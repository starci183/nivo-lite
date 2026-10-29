import { LoyaltyCustomerLinkEntity } from "./loyalty-customer-link.entity"

export { LoyaltyCustomerLinkEntity }
export type { LoyaltyCustomerLinkKind } from "./loyalty-customer-link.entity"

/** The entities the loyalty-customer-links capability owns, collected by the database module. */
export const loyaltyCustomerLinksEntities = [LoyaltyCustomerLinkEntity] as const
