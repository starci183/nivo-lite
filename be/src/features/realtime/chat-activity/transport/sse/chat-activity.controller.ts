import { Controller, Headers, Sse } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import type { Observable } from "rxjs"
import { chatActivityTopic } from "@modules/domain/chat-activity"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"

@Controller("realtime/office-activity")
/** The push door of the chat changes a member may see: it subscribes the stream to the caller's own topic of the hub and writes nothing. */
export class ChatActivityController {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /**
     * The message, receipt and unread notifications of every room and conversation of the selected workspace, as server-sent
     * events. The topic starts with the authenticated principal, and the publisher pushes a copy only to active members, so a
     * non-member's stream stays silent; a `Last-Event-ID` header only resumes after that frame inside the caller's own topic.
     */
    @Sse()
    stream(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Headers("last-event-id") lastEventId?: string,
    ): Observable<MessageEvent> {
        return this.hub.stream(chatActivityTopic(principal.id, workspaceId), { after: lastEventId })
    }
}
