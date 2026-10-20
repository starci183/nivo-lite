import { QueryHandler } from "@nestjs/cqrs"
import { OfficeRoomsService } from "@modules/domain/office-rooms"
import type { RoomView } from "@modules/domain/office-rooms"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListOfficeRoomsQuery } from "./list-office-rooms.query"

@QueryHandler(ListOfficeRoomsQuery)
/** Answers the Hub rooms from the office rooms service. */
export class ListOfficeRoomsHandler extends ICQRSHandler<ListOfficeRoomsQuery, ReadonlyArray<RoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rooms: OfficeRoomsService,
    ) {
        super(logger)
    }

    protected override process(query: ListOfficeRoomsQuery): Promise<ReadonlyArray<RoomView>> {
        return this.rooms.rooms(query.params.principal.id, query.params.request.workspaceId)
    }
}
