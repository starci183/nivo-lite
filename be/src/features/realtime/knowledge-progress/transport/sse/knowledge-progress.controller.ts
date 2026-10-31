import { Controller, Headers, Sse } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import type { Observable } from "rxjs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { knowledgeProgressTopic } from "@modules/domain/knowledge-sources"
import { WorkspaceId } from "@modules/domain/workspace-members"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"

@Controller("realtime/knowledge-progress")
/** The push door of the indexing progress of the sources a member may see: it subscribes the stream to the caller's own topic of the hub and writes nothing. */
export class KnowledgeProgressController {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /**
     * The stage, count and status changes of every source of the selected workspace, as server-sent events. The topic starts with
     * the authenticated principal and the publisher pushes a copy only to active members, so a non-member's stream stays silent. It
     * sends no snapshot: a client reads the stored state through the sources query on every open, and each frame carries the whole
     * state of one source with its time `at`, so the newest wins. A `Last-Event-ID` header only resumes inside the caller's own topic.
     */
    @Sse()
    stream(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Headers("last-event-id") lastEventId?: string,
    ): Observable<MessageEvent> {
        return this.hub.stream(knowledgeProgressTopic(principal.id, workspaceId), { after: lastEventId })
    }
}
