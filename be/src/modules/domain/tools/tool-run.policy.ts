import type { NodeRunClaims } from "@modules/domain/graph-nodes"
import type { Locale } from "@modules/platform/i18n"
import type { ToolRun } from "./tools.contracts"

/**
 * The claims of a run token as the gateway reads its step from them: the claims every token carries, and the ones the host signs for a
 * graph step (the language, the agent that handed its conversation over, the lead of a run with no conversation, the step's allow-list).
 */
export type StepClaims = NodeRunClaims & {
    /** The language of the run. */
    readonly locale?: Locale | undefined
    /** The agent that handed its conversation to the run, or null. */
    readonly handedOffBy?: string | null | undefined
    /** The contact (the person) of the run, or null. */
    readonly contactId?: string | null | undefined
    /** The sales lead a module resolved as the run's subject, or null: the bridge of the module effects' pin. */
    readonly leadId?: string | null | undefined
    /** The tools the step may call. */
    readonly stepTools?: ReadonlyArray<string> | undefined
}

/**
 * The graph step a token's claims name, or undefined when the token does not carry one (no language or no allow-list signed): a call
 * without a step reaches no tool that needs one.
 */
export const runOfClaims = (claims: StepClaims): ToolRun | undefined => {
    if (claims.locale === undefined || claims.stepTools === undefined) return undefined
    return {
        turnId: claims.runId,
        locale: claims.locale,
        origin: claims.origin,
        memberId: claims.memberId,
        handedOffBy: claims.handedOffBy ?? null,
        contactId: claims.contactId ?? null,
        leadId: claims.leadId ?? null,
        stepTools: claims.stepTools,
    }
}
