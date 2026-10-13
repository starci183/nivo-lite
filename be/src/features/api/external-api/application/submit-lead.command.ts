import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SubmitLeadRequest, SubmitLeadResult } from "./submit-lead.contracts"

/** Asks to hand a customer over to the sales flow of the workspace the API key acts for. */
export class SubmitLeadCommand extends Command<SubmitLeadResult> {
    constructor(readonly params: PublicExecuteParams<SubmitLeadRequest>) {
        super()
    }
}
