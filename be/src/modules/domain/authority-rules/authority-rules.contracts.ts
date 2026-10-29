import type { Proposal, ReasonCode } from "@modules/domain/work-items"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
/** What a rule of the owner's authority says about an action: run alone, ask a person, or never. */
export type RuleMode = "auto" | "ask" | "never"

/** What the amount of an action is counted in: money, a percentage (a discount) or a count (nights, items). */
export type RuleUnit = "vnd" | "percent" | "count"

/** The units a rule can count in. */
export const RULE_UNITS: ReadonlyArray<RuleUnit> = ["vnd", "percent", "count"]

/** How a group of approvers decides: the first one, all of them, or one after another in order. */
export type ApprovalPolicy = "any" | "all" | "sequential"

/** The approval policies a rule can name. */
export const APPROVAL_POLICIES: ReadonlyArray<ApprovalPolicy> = ["any", "all", "sequential"]

/** The longest a request may wait: one week. */
export const MAX_TIMEOUT_MINUTES = 10_080

/** The approver group of a rule: everyone with one of the roles, seated in one of the rooms, or named. */
export interface ApproverGroup {
    /** Workspace roles whose members are in the group. */
    readonly roles: ReadonlyArray<WorkspaceRole>
    /** Keys of the department rooms whose people are in the group. */
    readonly rooms: ReadonlyArray<string>
    /** Member ids named one by one; their order is the order a sequential policy asks them. */
    readonly members: ReadonlyArray<string>
}

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
    /** The action runs alone strictly below this amount, VND; null means no limit. Rules with bands ignore it. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
    /** What the amount is counted in; absent means VND, as every rule was before units. */
    readonly unit?: RuleUnit
    /** The action runs alone up to this amount (inclusive); absent or null means no auto band. */
    readonly auto_max?: number | null
    /** A person is asked above the auto band up to this amount (inclusive), above it the action never runs; absent or null means no upper bound. */
    readonly ask_max?: number | null
    /** The agents the rule applies to; absent or empty means every agent. */
    readonly agents?: ReadonlyArray<string>
}

/** The rule of one action, or null when the owner granted none. */
export type OptionalAuthorityRule = AuthorityRule | null

/** The part of a rule its bands read: its mode and its two bounds. */
export interface RuleBounds {
    /** The mode of the rule. */
    readonly mode: RuleMode
    /** The action runs alone up to this amount (inclusive); absent or null means no auto band. */
    readonly auto_max?: number | null
    /** A person is asked up to this amount (inclusive); absent or null means no upper bound. */
    readonly ask_max?: number | null
}

/** The amount of a proposal in the unit of its rule, or null when it carries none. */
export type OptionalAmount = number | null

/** The band an amount falls in, or null when the rule has no bands. */
export type OptionalBand = RuleMode | null

/** The agent a caller acts for, or null for a person or the system. */
export type OptionalRuleAgent = string | null

/** The agents a rule lists; absent when the rule carries no list. */
export type RuleAgentList = ReadonlyArray<string> | undefined

/** A stored rule with its workspace, note and approval settings, as the Authority page lists it. */
export interface AuthorityRuleRecord extends AuthorityRule {
    /** The workspace. */
    readonly workspace_id: string
    /** A note on the rule. */
    readonly note: string
    /** When it was saved last. */
    readonly updated_at: string
    /** What the amount is counted in. */
    readonly unit: RuleUnit
    /** The action runs alone up to this amount (inclusive); null means no auto band. */
    readonly auto_max: number | null
    /** A person is asked up to this amount (inclusive), above it the action never runs; null means no upper bound. */
    readonly ask_max: number | null
    /** The agents the rule applies to; empty means every agent. */
    readonly agents: ReadonlyArray<string>
    /** Roles whose members may approve. */
    readonly approver_roles: ReadonlyArray<WorkspaceRole>
    /** Department rooms whose people may approve. */
    readonly approver_rooms: ReadonlyArray<string>
    /** Members named as approvers, in the order they are asked. */
    readonly approver_members: ReadonlyArray<string>
    /** How the approvers decide. */
    readonly approval_policy: ApprovalPolicy
    /** Minutes a request waits before it goes to the owner of the agent. */
    readonly timeout_minutes: number
}

/**
 * The approval side of a rule, as a request for approval reads it: where the action stands, in which unit and bands, who may
 * approve, how they decide and for how long.
 */
export interface ApprovalSetup {
    /** The module. */
    readonly department: string
    /** The action key. */
    readonly action: string
    /** The mode of the rule. */
    readonly mode: RuleMode
    /** What the amount is counted in. */
    readonly unit: RuleUnit
    /** The auto band bound, or null. */
    readonly auto_max: number | null
    /** The ask band bound, or null. */
    readonly ask_max: number | null
    /** Who may approve. */
    readonly group: ApproverGroup
    /** How they decide. */
    readonly policy: ApprovalPolicy
    /** Minutes before the request expires. */
    readonly timeout_minutes: number
    /** The agents the rule applies to; empty means every agent. */
    readonly agents: ReadonlyArray<string>
}

/** The approval side of a rule, or null when the owner granted none. */
export type OptionalApprovalSetup = ApprovalSetup | null

/** One rule a manager saves. A field of the approval settings left out keeps what is stored (or the default for a new rule). */
export interface RuleChange {
    /** The action key. */
    readonly action: string
    /** The module the action belongs to; it must match the registry. */
    readonly department: string
    /** The mode. With bands it follows them: "auto" when there is an auto band, else "ask"; "never" stays "never". */
    readonly mode: RuleMode
    /** The action runs alone strictly below this amount, VND; null means no limit. Saved as null with bands or a unit other than VND. */
    readonly limit_vnd: number | null
    /** Fields that must be present. */
    readonly required_fields: ReadonlyArray<string>
    /** A note on the rule; null leaves the stored note as it is. */
    readonly note: string | null
    /** What the amount is counted in. */
    readonly unit?: RuleUnit
    /** The action runs alone up to this amount (inclusive); null clears the auto band. */
    readonly auto_max?: number | null
    /** A person is asked up to this amount (inclusive), above it the action never runs; null clears the upper bound. */
    readonly ask_max?: number | null
    /** Roles whose members may approve. */
    readonly approver_roles?: ReadonlyArray<WorkspaceRole>
    /** Department rooms whose people may approve. */
    readonly approver_rooms?: ReadonlyArray<string>
    /** Members named as approvers, in the order they are asked. */
    readonly approver_members?: ReadonlyArray<string>
    /** How the approvers decide. */
    readonly approval_policy?: ApprovalPolicy
    /** Minutes a request waits before it goes to the owner of the agent. */
    readonly timeout_minutes?: number
    /** The agents the rule applies to; empty means every agent. */
    readonly agents?: ReadonlyArray<string>
}

/** The approval settings a change carries, as the statement merges them into the stored rule: only the keys the caller named. */
export interface RuleSettingsPatch {
    /** What the amount is counted in. */
    readonly unit?: RuleUnit
    /** The auto band bound; null clears it. */
    readonly auto_max?: number | null
    /** The ask band bound; null clears it. */
    readonly ask_max?: number | null
    /** Roles whose members may approve. */
    readonly approver_roles?: ReadonlyArray<WorkspaceRole>
    /** Department rooms whose people may approve. */
    readonly approver_rooms?: ReadonlyArray<string>
    /** Members named as approvers. */
    readonly approver_members?: ReadonlyArray<string>
    /** How the approvers decide. */
    readonly approval_policy?: ApprovalPolicy
    /** Minutes before the request expires. */
    readonly timeout_minutes?: number
    /** The agents the rule applies to. */
    readonly agents?: ReadonlyArray<string>
}

/** A change after it was judged: the mode and limit the table stores, and the settings to merge. */
export interface JudgedChange {
    /** The mode to store. */
    readonly mode: RuleMode
    /** The legacy limit to store. */
    readonly limit_vnd: number | null
    /** The approval settings to merge into the stored rule. */
    readonly settings: RuleSettingsPatch
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

/** One stored rule as a department's page lists it, read only. */
export interface DepartmentRuleLine {
    /** The action the rule governs. */
    readonly action: string
    /** The department (module key) that owns the action. */
    readonly department: string
    /** The mode of the rule. */
    readonly mode: RuleMode
    /** The amount limit in VND, or null. */
    readonly limitVnd: number | null
    /** A note on the rule. */
    readonly note: string
}
