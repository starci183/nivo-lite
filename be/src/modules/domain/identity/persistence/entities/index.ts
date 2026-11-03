import { IdentityPasswordTokenEntity } from "./identity-password-token.entity"
import { IdentityRefreshTokenEntity } from "./identity-refresh-token.entity"
import { IdentitySessionEntity } from "./identity-session.entity"

export { IdentityPasswordTokenEntity, IdentityRefreshTokenEntity, IdentitySessionEntity }

/** Every entity the identity capability owns, collected by the database connection. */
export const identityEntities: readonly [
    typeof IdentityRefreshTokenEntity,
    typeof IdentityPasswordTokenEntity,
    typeof IdentitySessionEntity,
] = [IdentityRefreshTokenEntity, IdentityPasswordTokenEntity, IdentitySessionEntity]
