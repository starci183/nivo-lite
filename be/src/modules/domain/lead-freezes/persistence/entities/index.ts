import { ContactFreezeEntity } from "./contact-freeze.entity"

export { ContactFreezeEntity }

/** The entities the lead freezes own, collected by the database module. */
export const leadFreezesEntities: readonly [typeof ContactFreezeEntity] = [ContactFreezeEntity] as const
