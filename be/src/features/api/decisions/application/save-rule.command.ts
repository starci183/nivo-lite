import { Command } from "@nestjs/cqrs"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveRuleRequest } from "./save-rule.contracts"

/** Asks to save the rule of one action. */
export class SaveRuleCommand extends Command<AuthorityRuleRecord> {
    constructor(readonly params: ExecuteParams<SaveRuleRequest>) {
        super()
    }
}
