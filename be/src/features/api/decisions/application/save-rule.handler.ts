import { CommandHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveRuleCommand } from "./save-rule.command"

@CommandHandler(SaveRuleCommand)
/** Saves the rule through the decisions service. */
export class SaveRuleHandler extends ICQRSHandler<SaveRuleCommand, AuthorityRuleRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveRuleCommand): Promise<AuthorityRuleRecord> {
        return this.decisions.saveRule(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.change,
        )
    }
}
