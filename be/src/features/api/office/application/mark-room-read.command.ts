import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MarkRoomReadRequest } from "./mark-room-read.contracts"

/** Asks to mark a Hub room read by the caller up to now. */
export class MarkRoomReadCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<MarkRoomReadRequest>) {
        super()
    }
}
