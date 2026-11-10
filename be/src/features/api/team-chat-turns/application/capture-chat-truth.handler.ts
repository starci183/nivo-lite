import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatTurnsService } from "@modules/domain/team-chat-turns"
import type { CaptureOutcome } from "@modules/domain/team-chat-turns"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CaptureChatTruthCommand } from "./capture-chat-truth.command"

@CommandHandler(CaptureChatTruthCommand)
/** "Ghi vào Second Brain": the owner or a manager files a message as a truth change; the card waits in the room for the owner. */
export class CaptureChatTruthHandler extends ICQRSHandler<CaptureChatTruthCommand, CaptureOutcome> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly turns: TeamChatTurnsService,
    ) {
        super(logger)
    }

    protected override process(command: CaptureChatTruthCommand): Promise<CaptureOutcome> {
        const { request, principal } = command.params
        return this.turns.capture(request.workspaceId, principal.id, {
            messageId: request.messageId,
            agentId: request.agentId,
            fact: request.fact,
        })
    }
}
