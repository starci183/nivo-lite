import type { Proposal, ReasonCode } from "@modules/domain/work-items"
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
    /** The action key. */
    readonly action: string
    /** The module the action belongs to; it must match the registry. */
    readonly department: string
    /** The mode. */
    readonly mode: RuleMode
    /** The action runs alone strictly below this amount, VND; null means no limit. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
    /** A note on the rule; null leaves the stored note as it is. */
    readonly note: string | null
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

/** The rule a module grants to an action when it is installed. */
export interface DefaultRule {
    /** The action key. */
    readonly action: string
    /** The default mode. */
    readonly mode: RuleMode
    /** The default amount limit, VND; null for none. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
}

/** What the gate answers. */
export interface GateVerdict {
    /** Run alone or ask. */
    readonly verdict: "auto" | "ask"
    /** The first reason. */
    readonly reason: ReasonCode
    /** Every reason. */
    readonly reasons: ReadonlyArray<ReasonCode>
    /** Required fields still missing. */
    readonly missing: ReadonlyArray<string>
}

/** What the gate reads. */
export interface GateInput {
    /** The action key. */
    readonly action: string
    /** The rule of the owner for the action, or null when there is none. */
    readonly rule: OptionalAuthorityRule
    /** The cap the registry puts on the action: it can never run alone above it. */
    readonly maxMode: RuleMode | null
    /** What the agent proposes. */
    readonly proposal: Proposal
    /** True when a person approved this very item. */
    readonly humanApproved?: boolean
}

/** An amount in VND, or none. */
export type OptionalAmountVnd = number | null | undefined
