import type { RuleChange } from "@modules/domain/authority-rules"

/** What saving an authority rule takes. */
export interface SaveRuleRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The rule to save. */
    readonly change: RuleChange
}
