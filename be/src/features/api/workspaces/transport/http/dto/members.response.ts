import { MemberResponse } from "./memberships.response"

/** A member as the team page lists them. */
export class MemberListingResponse extends MemberResponse {
    /** The account email; blank for staff viewers. */
    email!: string
    /** The last sign-in, ISO 8601; null when unknown. */
    lastSignInAt!: string | null
}
