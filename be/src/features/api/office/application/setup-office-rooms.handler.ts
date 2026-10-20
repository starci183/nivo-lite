import { CommandHandler } from "@nestjs/cqrs"
import { OfficeRoomsService } from "@modules/domain/office-rooms"
import type { RoomView } from "@modules/domain/office-rooms"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetupOfficeRoomsCommand } from "./setup-office-rooms.command"

@CommandHandler(SetupOfficeRoomsCommand)
/** Opens the department rooms through the office rooms service. */
export class SetupOfficeRoomsHandler extends ICQRSHandler<SetupOfficeRoomsCommand, ReadonlyArray<RoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rooms: OfficeRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: SetupOfficeRoomsCommand): Promise<ReadonlyArray<RoomView>> {
        return this.rooms.setup(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.locale,
        )
    }
}
