export type {
    Bilingual,
    BilingualList,
    ModuleAudience,
    ModuleAuthorityMode,
    ModuleCapabilityRole,
    ModuleFactSubject,
    ModuleGateWrite,
    ModuleListProblem,
    ModuleListProblemCode,
    ModuleServer,
    ModuleServerVocabulary,
    ModuleTemplate,
    ModuleTemplateAction,
    ModuleTemplateAgent,
    ModuleTemplateCommand,
    ModuleTemplateGate,
    ModuleTemplateRoles,
    ModuleTemplateRequirements,
    ModuleTemplateTrigger,
    ModuleTriggerPreset,
} from "./module.types"
export { moduleListProblems, templatesOf } from "./registry"
export type {
    ClaimSpec,
    FactRef,
    IntentSpec,
    LimitSpec,
    MemberSpec,
    ModuleAgentTemplate,
    ModuleContracts,
    ModuleDocument,
    ModuleDocumentAction,
    ModuleDocumentGate,
    ModuleDocumentSchemaId,
    ModuleManifest,
    ModuleProblem,
    ModuleProblemCode,
    OutcomeCondition,
    OutcomeRulesSpec,
    OutcomeSpec,
    SignalSpec,
} from "./module-document.types"
export { moduleDocumentSchema } from "./module-document.schema"
export { MODULE_CHANGELOG_MAX, moduleProblems } from "./module-problems"
export type {
    ModuleAgent,
    ModuleAbilityDefault,
    ModuleAbilityDefaults,
    ModuleAgentAbilities,
    ModuleAgentPolicy,
    ModuleDeclaration,
    ModuleDeclarationConfig,
    SeedSpecProblem,
} from "./declaration.types"
export type { CountsReadConfig, ListReadConfig, ListReadDefinition } from "./declaration-list.types"
export type { ActionInputResult, ReadVariablesResult } from "./declaration-input"
export { countsRead, listRead } from "./declaration-list"
export { defineModule, seedSpecProblems } from "./declaration"
export { actionInputOf, readVariablesOf } from "./declaration-input"
