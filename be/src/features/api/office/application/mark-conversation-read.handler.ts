import { CommandHandler } from "@nestjs/cqrs"
import { OfficeRoomsService } from "@modules/domain/office-rooms"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarkConversationReadCommand } from "./mark-conversation-read.command"

@CommandHandler(MarkConversationReadCommand)
/** Marks the direct conversation read through the office rooms service. */
export class MarkConversationReadHandler extends ICQRSHandler<MarkConversationReadCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rooms: OfficeRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: MarkConversationReadCommand): Promise<void> {
        return this.rooms.markConversationRead(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.kind,
            command.params.request.id,
        )
    }
}
