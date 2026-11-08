import { CommandHandler } from "@nestjs/cqrs"
import { FlowsService, type FlowResult } from "@modules/domain/flows"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RunFlowCommand } from "./run-flow.command"

@CommandHandler(RunFlowCommand)
/** Runs one operating-flow command as the signed-in member. */
export class RunFlowHandler extends ICQRSHandler<RunFlowCommand, FlowResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly flows: FlowsService,
    ) {
        super(logger)
    }

    protected override process(message: RunFlowCommand): Promise<FlowResult> {
        return this.flows.run(
            message.params.principal.id,
            message.params.request.workspaceId,
            message.params.request.flow,
        )
    }
}
