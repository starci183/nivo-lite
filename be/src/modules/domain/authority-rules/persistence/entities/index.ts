import { AuthorityRuleEntity } from "./authority-rule.entity"

export { AuthorityRuleEntity }

/** Every entity the authority-rules capability owns, collected by the database connection. */
export const authorityRulesEntities = [AuthorityRuleEntity] as const
