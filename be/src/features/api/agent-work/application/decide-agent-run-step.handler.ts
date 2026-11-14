import { CommandHandler } from "@nestjs/cqrs"
import { AgentRunDecisionsService, type DecideAgentRunStepOutcome } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DecideAgentRunStepCommand } from "./decide-agent-run-step.command"

@CommandHandler(DecideAgentRunStepCommand)
/** Answers the approval a thread run waits on, in place on the run page, through the thread approvals' one door. */
export class DecideAgentRunStepHandler extends ICQRSHandler<DecideAgentRunStepCommand, DecideAgentRunStepOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: AgentRunDecisionsService,
    ) {
        super(logger)
    }

    protected override process(command: DecideAgentRunStepCommand): Promise<DecideAgentRunStepOutcome> {
        return this.decisions.decide(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.runId,
            command.params.request.stepKey,
            command.params.request.verdict,
            command.params.request.locale,
        )
    }
}
