import { CommandHandler } from "@nestjs/cqrs"
import { OfficeRoomsService } from "@modules/domain/office-rooms"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarkRoomReadCommand } from "./mark-room-read.command"

@CommandHandler(MarkRoomReadCommand)
/** Marks the room read through the office rooms service. */
export class MarkRoomReadHandler extends ICQRSHandler<MarkRoomReadCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rooms: OfficeRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: MarkRoomReadCommand): Promise<void> {
        return this.rooms.markRead(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.room,
        )
    }
}
