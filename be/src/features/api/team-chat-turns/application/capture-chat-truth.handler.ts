import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatTurnsService, type CaptureOutcome } from "@modules/domain/team-chat-turns"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CaptureChatTruthCommand } from "./capture-chat-truth.command"

@CommandHandler(CaptureChatTruthCommand)
/** "Record into the Second Brain": the owner or a manager files a message as a truth change; the card waits in the room for the owner. */
export class CaptureChatTruthHandler extends ICQRSHandler<CaptureChatTruthCommand, CaptureOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly turns: TeamChatTurnsService,
    ) {
        super(logger)
    }

    protected override process(command: CaptureChatTruthCommand): Promise<CaptureOutcome> {
        return this.turns.capture(command.params.request.workspaceId, command.params.principal.id, {
            messageId: command.params.request.messageId,
            agentId: command.params.request.agentId,
            fact: command.params.request.fact,
        })
    }
}
