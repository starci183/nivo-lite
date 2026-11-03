import { AuthorityRuleEntity } from "./authority-rule.entity"

export { AuthorityRuleEntity }

/** Every entity the authority-rules capability owns, collected by the database connection. */
export const authorityRulesEntities: readonly [typeof AuthorityRuleEntity] = [AuthorityRuleEntity] as const
