import { IdentityPasswordTokenEntity } from "./identity-password-token.entity"
import { IdentityRefreshTokenEntity } from "./identity-refresh-token.entity"

export { IdentityPasswordTokenEntity, IdentityRefreshTokenEntity }

/** Every entity the identity capability owns, collected by the database connection. */
export const identityEntities: readonly [typeof IdentityRefreshTokenEntity, typeof IdentityPasswordTokenEntity] = [
    IdentityRefreshTokenEntity,
    IdentityPasswordTokenEntity,
] as const
