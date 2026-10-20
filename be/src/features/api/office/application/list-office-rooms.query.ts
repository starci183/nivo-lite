import { Query } from "@nestjs/cqrs"
import type { RoomView } from "@modules/domain/office-rooms"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListOfficeRoomsRequest } from "./list-office-rooms.contracts"

/** Asks for the Hub rooms with the caller's unread counts. */
export class ListOfficeRoomsQuery extends Query<ReadonlyArray<RoomView>> {
    constructor(readonly params: ExecuteParams<ListOfficeRoomsRequest>) {
        super()
    }
}
