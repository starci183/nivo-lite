import { ApiKeyEntity } from "./api-key.entity"
import { ApiRateLimitEntity } from "./api-rate-limit.entity"

export { ApiKeyEntity, ApiRateLimitEntity }

/** Every entity the api-keys capability owns, collected by the database connection. */
export const apiKeysEntities = [ApiKeyEntity, ApiRateLimitEntity] as const
