import { DomainError } from "@starci/common"

/** Thrown when a fixture of the testing export cannot build what a spec asked for, so the spec fails on its own set-up. */
export class FixtureError extends DomainError<"FIXTURE_REFUSED"> {
    constructor(code: "FIXTURE_REFUSED", at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}
