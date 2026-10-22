export { AUTHORITY_RULES_ERROR_KINDS } from "./errors/authority-rules.error"
export { AUTHORITY_RULES_MESSAGES } from "./messages/authority-rules.messages"
export type {
    ApprovalPolicy,
    ApprovalSetup,
    ApproverGroup,
    AuthorityRule,
    AuthorityRuleRecord,
    DefaultRule,
    GateVerdict,
    OptionalAuthorityRule,
    RuleChange,
    RuleMode,
    RuleUnit,
} from "./authority-rules.contracts"
export { APPROVAL_POLICIES, RULE_UNITS } from "./authority-rules.contracts"
export { AuthorityRulesModule } from "./authority-rules.module"
export { AuthorityRulesService } from "./authority-rules.service"
export { bandOf, evaluateGate, isOverLimit } from "./gate.policy"
export { appliesToAgent } from "./rule-settings.policy"
