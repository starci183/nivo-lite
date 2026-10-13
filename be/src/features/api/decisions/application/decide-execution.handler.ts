import { CommandHandler } from "@nestjs/cqrs"
import { WorkDecisionService } from "@modules/domain/decisions"
import type { ExecutionRow } from "@modules/domain/executions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideExecutionCommand } from "./decide-execution.command"

@CommandHandler(DecideExecutionCommand)
/** Decides the card through the work decision service. */
export class DecideExecutionHandler extends ICQRSHandler<DecideExecutionCommand, ExecutionRow> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: WorkDecisionService,
    ) {
        super(logger)
    }

    protected override process(command: DecideExecutionCommand): Promise<ExecutionRow> {
        return this.decisions.decideExecution(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
