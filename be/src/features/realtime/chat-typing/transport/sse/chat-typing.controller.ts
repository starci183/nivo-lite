import { Controller, Headers, Query, Sse } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import { IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"
import type { Observable } from "rxjs"
import { chatTypingTopic } from "@modules/domain/chat-typing"
import { CurrentPrincipal } from "@modules/domain/identity"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"
import { WorkspaceId } from "@modules/domain/workspace-members"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"

/** The target of one typing stream: a department room, an agent/customer conversation, or neither for the general Office. */
export class ChatTypingStreamQuery {
    /** A department room key, mutually exclusive with conversationId. */
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null

    /** A conversation id of the selected workspace. */
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    conversationId: string | null = null
}

@Controller("realtime/chat-typing")
/** The push door of the typing hints a caller may see: it subscribes the stream to the caller's own topic of the hub and writes nothing. */
export class ChatTypingController {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /**
     * The typing frames of one room or conversation, as server-sent events. The topic starts with the authenticated principal, and
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
        return this.hub.stream(
            chatTypingTopic(principal.id, workspaceId, { room: query.room, conversationId: query.conversationId }),
            { after: lastEventId },
        )
    }
}
