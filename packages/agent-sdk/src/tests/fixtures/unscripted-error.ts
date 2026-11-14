import { DomainError } from "@starci/common"

/** What a call past the end of a script is refused with. */
export type UnscriptedCode = "MODEL_UNSCRIPTED" | "TOOL_UNSCRIPTED"

/** Thrown when a node calls the model or a tool more often than its example scripted; `params.at` repeats the code. */
export class UnscriptedError extends DomainError<UnscriptedCode> {
    constructor(code: UnscriptedCode) {
        super({ code, params: { at: code } })
    }
}
