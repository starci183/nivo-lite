import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SuggestAutomationsRequest, SuggestAutomationsResult } from "./suggest-automations.contracts"

/** Lists the templates worth proposing for a module. */
export class SuggestAutomationsQuery extends Query<SuggestAutomationsResult> {
    constructor(readonly params: ExecuteParams<SuggestAutomationsRequest>) {
        super()
    }
}
