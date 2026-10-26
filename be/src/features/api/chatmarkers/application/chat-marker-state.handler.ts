import { QueryHandler } from "@nestjs/cqrs"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import type { ChatMarkerState } from "@modules/domain/chat-markers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatMarkerStateQuery } from "./chat-marker-state.query"

@QueryHandler(ChatMarkerStateQuery)
/** Reads receipts and mute preferences after the service proves membership and chat scope. */
export class ChatMarkerStateHandler extends ICQRSHandler<ChatMarkerStateQuery, ChatMarkerState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly markers: ChatMarkersService,
    ) {
        super(logger)
    }

    protected override process(query: ChatMarkerStateQuery): Promise<ChatMarkerState> {
        return this.markers.state(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.target,
        )
    }
}
