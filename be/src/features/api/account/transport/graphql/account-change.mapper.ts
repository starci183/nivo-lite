import type { RevokeSessionRequest } from "../../application/revoke-session.contracts"
import type { UpdateProfileRequest } from "../../application/update-profile.contracts"
import type { RevokeSessionInput } from "./dto/revoke-session.input"
import type { UpdateProfileInput } from "./dto/update-profile.input"

/** Maps the GraphQL input to the sign-out request of one device. */
export const toRevokeSessionRequest = (input: RevokeSessionInput): RevokeSessionRequest => ({
    sessionId: input.sessionId,
})

/** Maps the GraphQL input to the rename request. */
export const toUpdateProfileRequest = (input: UpdateProfileInput): UpdateProfileRequest => ({
    name: input.name,
})
