import { Command } from "@nestjs/cqrs"
import type { RoomView } from "@modules/domain/office-rooms"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetupOfficeRoomsRequest } from "./list-office-rooms.contracts"

/** Asks to open the six department rooms of the workspace. */
export class SetupOfficeRoomsCommand extends Command<ReadonlyArray<RoomView>> {
    constructor(readonly params: ExecuteParams<SetupOfficeRoomsRequest>) {
        super()
    }
}
