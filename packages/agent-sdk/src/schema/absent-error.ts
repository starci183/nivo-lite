import { DomainError } from "@starci/common"

/** Thrown by `present` when a value a caller counted on is not there; `params.at` says what was expected. */
export class AbsentError extends DomainError<"ABSENT"> {
    constructor(at: string) {
        super({ code: "ABSENT", params: { at } })
    }
}
