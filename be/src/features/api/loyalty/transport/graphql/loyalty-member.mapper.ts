import type { GetMemberDetailRequest } from "../../application/get-member-detail.contracts"
import type { LoyaltyMemberInput } from "./dto/loyalty-member.input"

/** Maps workspace selection and bounded input into the application request. */
export const toLoyaltyMemberRequest = (input: LoyaltyMemberInput, workspaceId: string): GetMemberDetailRequest => ({
    workspaceId,
    ...input,
})

export { toLoyaltyMemberType } from "@modules/domain/loyalty"
