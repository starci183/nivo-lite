import { ApiKeyEntity } from "./api-key.entity"

export { ApiKeyEntity }

/** Every entity the api-keys capability owns, collected by the database connection. */
export const apiKeysEntities = [ApiKeyEntity] as const
