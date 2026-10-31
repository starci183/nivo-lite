import type { ApprovalPolicy, ApproverGroup, RuleMode, RuleUnit } from "@modules/domain/authority-rules"

/** A text in both product languages, as the catalogue holds it. */
export interface SeedText {
    /** The Vietnamese text. */
    readonly vi: string
    /** The English text. */
    readonly en: string
}

/** What starts a template, as the base graph reads it. */
export interface SeedTrigger {
    /** An internal event, or a schedule. */
    readonly kind: "event" | "schedule"
    /** The plain-words line on the card. */
    readonly line: SeedText
}

/** The authority action a template message goes through, as the base graph reads it. */
export interface SeedAuthority {
    /** The action; null sends nothing to a customer. */
    readonly action: string | null
    /** True when the owner always decides. */
    readonly alwaysAsk?: boolean | undefined
}

/** An action of a module as the base graph reads it; `ModuleDefinition.authorityActions` fits. */
export interface SeedAction {
    /** The action. */
    readonly action: string
    /** The label. */
    readonly label: SeedText
    /** The mode. */
    readonly mode: RuleMode
    /** The amount limit. */
    readonly amountLimit: boolean
    /** The max mode. */
    readonly maxMode: "ask" | "never" | null
    /** The facts a decide point on this action reads from real records; the first is its amount. */
    readonly graphFacts?: ReadonlyArray<string> | undefined
}

/** A module as the base graph reads it; `ModuleDefinition` fits. */
export interface SeedModule {
    /** The key. */
    readonly key: string
    /** The name. */
    readonly name: SeedText
    /** The connection providers. */
    readonly connectionProviders: ReadonlyArray<string>
    /** The authority actions. */
    readonly authorityActions: ReadonlyArray<SeedAction>
}

/** A template as the base graph reads it; `TemplateDefinition` fits. */
export interface SeedTemplate {
    /** The key. */
    readonly key: string
    /** The version. */
    readonly version: number
    /** The executor. */
    readonly executor: "implemented" | "n8n" | "definition"
    /** The name. */
    readonly name: SeedText
    /** The trigger. */
    readonly trigger: SeedTrigger
    /** The authority. */
    readonly authority: SeedAuthority
}

/** An authority rule as the seed reads it; `AuthorityRuleRecord` fits. */
export interface SeedRule {
    /** The action. */
    readonly action: string
    /** The mode. */
    readonly mode: RuleMode
    /** The unit. */
    readonly unit: RuleUnit
    /** The limit_vnd. */
    readonly limit_vnd: number | null
    /** The auto_max. */
    readonly auto_max: number | null
    /** The ask_max. */
    readonly ask_max: number | null
    /** The approver_roles. */
    readonly approver_roles: ApproverGroup["roles"]
    /** The approver_rooms. */
    readonly approver_rooms: ApproverGroup["rooms"]
    /** The approver_members. */
    readonly approver_members: ApproverGroup["members"]
    /** The approval_policy. */
    readonly approval_policy: ApprovalPolicy
    /** The timeout_minutes. */
    readonly timeout_minutes: number
}
