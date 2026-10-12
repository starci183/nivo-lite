import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveContractRequest, SaveContractResult } from "./save-contract.contracts"

/** Asks to add or edit a recurring sales contract of the workspace of the caller. */
export class SaveContractCommand extends Command<SaveContractResult> {
    constructor(readonly params: ExecuteParams<SaveContractRequest>) {
        super()
    }
}
