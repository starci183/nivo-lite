export { AUTHORITY_RULES_ERROR_KINDS } from "./errors/authority-rules.error"
export { AUTHORITY_RULES_MESSAGES } from "./messages/authority-rules.messages"
export type {
    AuthorityRule,
    AuthorityRuleRecord,
    DefaultRule,
    GateVerdict,
    OptionalAuthorityRule,
    RuleChange,
    RuleMode,
} from "./authority-rules.contracts"
export { AuthorityRulesModule } from "./authority-rules.module"
export { AuthorityRulesService } from "./authority-rules.service"
export { evaluateGate, isOverLimit } from "./gate.policy"
