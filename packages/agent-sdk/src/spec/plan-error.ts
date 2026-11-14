import { DomainError } from "@starci/common"

/** Thrown when a plan is asked of a spec that was not validated, which is a wiring bug and never a stored document. */
export class PlanError extends DomainError<"PLAN_SPEC_UNVALIDATED"> {
    constructor(code: "PLAN_SPEC_UNVALIDATED", at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}
