import { MemberGrantEntity } from "./member-grant.entity"

export { MemberGrantEntity }
export type { MemberGrantUnit } from "./member-grant.entity"

/** The entities the member-grants capability owns, collected by the database module. */
export const memberGrantsEntities = [MemberGrantEntity] as const
