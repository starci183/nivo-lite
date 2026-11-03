import { AiQuotaOverrideEntity } from "./ai-quota-override.entity"

export { AiQuotaOverrideEntity }

/** Every entity the ai-quota-overrides capability owns, collected by the database connection. */
export const aiQuotaOverridesEntities: readonly [typeof AiQuotaOverrideEntity] = [AiQuotaOverrideEntity] as const
