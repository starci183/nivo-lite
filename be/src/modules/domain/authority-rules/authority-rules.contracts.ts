/** What a rule of the owner's authority says about an action: run alone, ask a person, or never. */
export type RuleMode = "auto" | "ask" | "never"

/** The rule of the owner's authority for one action. */
export interface AuthorityRule {
    /** The id. */
    readonly id: string
    /** The module. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** The mode. */
    readonly mode: RuleMode
    /** The action runs alone strictly below this amount, VND; null means no limit. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
}

/** The rule of one action, or null when the owner granted none. */
export type OptionalAuthorityRule = AuthorityRule | null

/** A stored rule with its workspace and note, as the Authority page lists it. */
export interface AuthorityRuleRecord extends AuthorityRule {
    /** The workspace. */
    readonly workspace_id: string
    /** A note on the rule. */
    readonly note: string
    /** When it was saved last. */
    readonly updated_at: string
}

/** One rule a manager saves. */
export interface RuleChange {
    /** The action key; its module is the one the registry gives. */
    readonly action: string
    /** The mode. */
    readonly mode: RuleMode
    /** The action runs alone strictly below this amount, VND; null means no limit. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
}

/** Whose rules a call reads: the workspace; a work context satisfies it structurally. */
export interface RulesScope {
    /** The workspace. */
    readonly workspaceId: string
}

/** An id, or null when there is none. */
export type OptionalRuleInstallation = string | null

/** The operating mode of the handling instance, when it is known. */
export type OptionalOperatingMode = string | null | undefined
