import type { DecisionHistoryKind } from "@modules/domain/decisions"

/** What listing the decision history takes. */
export interface ListDecisionHistoryRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Which decisions: every one, those the policy made alone, those a person made, or the rejected ones. */
    readonly kind: DecisionHistoryKind
    /** Only the decisions of this module; null for every module. */
    readonly department: string | null
    /** How many lines, clamped to 1..100. */
    readonly limit: number
}
