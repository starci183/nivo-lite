import { Controller, Headers, Query, Sse } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import { IsUUID } from "class-validator"
import type { Observable } from "rxjs"
import { chatTypingTopic } from "@modules/domain/chat-typing"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"

/** The room of one typing stream. */
export class ChatTypingStreamQuery {
    /** The team-chat room. */
    @IsUUID()
    roomId!: string
}

@Controller("realtime/chat-typing")
/** The push door of the typing hints a caller may see: it subscribes the stream to the caller's own topic of the hub and writes nothing. */
export class ChatTypingController {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /**
     * The typing frames of one room, as server-sent events. The topic starts with the authenticated principal, and
     * the publisher pushes a copy only to admitted members, so a non-member's stream stays silent; a `Last-Event-ID` header only
     * resumes after that frame inside the caller's own topic.
     */
    @Sse()
    stream(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Query() query: ChatTypingStreamQuery,
        @Headers("last-event-id") lastEventId?: string,
    ): Observable<MessageEvent> {
        return this.hub.stream(chatTypingTopic(principal.id, workspaceId, query.roomId), { after: lastEventId })
    }
}
