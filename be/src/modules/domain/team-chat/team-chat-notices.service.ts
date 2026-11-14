import { Injectable } from "@nestjs/common"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { BackgroundStopPosted, BackgroundStopReport } from "./background-stop-card.contracts"
import type { NivoNotice, NoticePosted } from "./team-chat-notice.contracts"
import {
    backgroundStoppedKeyOf,
    backgroundStoppedMessageOf,
    backgroundStoppedPayloadOf,
} from "./background-stop-card.policy"
import { cardBodyOf, lineClientIdOf, nivoRoomKeyOf } from "./team-chat.policy"
import { TeamChatStoreService } from "./team-chat-store.service"

@Injectable()
/**
 * What NIVO itself (no agent, no run) tells the founder in /chat: the common "background work stopped" card and a plain notice (a line
 * of words the caller built, once per key). It goes to the
 * founder's NIVO room (a direct room keyed `system:nivo|user:<owner>`, only the owner seated, opened on the first write and never on a
 * read), as a system line carrying the typed card. ONE card per failure episode: the line's key is the work and the episode, so a retry
 * of the same episode writes nothing new (the unique key `chat_room_messages_system_key`) and a new episode posts a new card. No agent
 * is picked and no run is invented; the card holds codes only, the web words it.
 */
export class TeamChatNoticesService {
    constructor(
        private readonly store: TeamChatStoreService,
        private readonly workspaces: WorkspacesService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Tells the workspace's founder that a background work stopped, once per failure episode. */
    async postBackgroundStopped(workspaceId: string, report: BackgroundStopReport): Promise<BackgroundStopPosted> {
        const ownerId = await this.workspaces.ownerIdOf(workspaceId)
        if (ownerId === null) return "no_owner"
        const roomId = await this.nivoRoomOf(workspaceId, ownerId)
        const message = backgroundStoppedMessageOf(backgroundStoppedPayloadOf(report, this.clock.now()))
        const created = await this.store.insertLine({
            workspaceId,
            roomId,
            authorAgentId: null,
            body: cardBodyOf(message.summary),
            key: backgroundStoppedKeyOf(report.work, report.episode),
            agentMessage: JSON.stringify(message),
        })
        return created === null ? "already" : "posted"
    }

    /**
     * Tells the workspace's founder one plain line of words in the NIVO room, once per key: a repeat of the same key writes nothing new.
     * The caller owns the words and the key (it says what an episode is); this door knows no business.
     */
    async postNotice(workspaceId: string, notice: NivoNotice): Promise<NoticePosted> {
        const ownerId = await this.workspaces.ownerIdOf(workspaceId)
        if (ownerId === null) return "no_owner"
        const roomId = await this.nivoRoomOf(workspaceId, ownerId)
        const created = await this.store.insertLine({
            workspaceId,
            roomId,
            authorAgentId: null,
            body: cardBodyOf(notice.body),
            key: lineClientIdOf(notice.key),
        })
        return created === null ? "already" : "posted"
    }

    /** The founder's NIVO room, opened (the founder alone seated, as its owner) when it does not exist yet. */
    private async nivoRoomOf(workspaceId: string, ownerId: string): Promise<string> {
        const directKey = nivoRoomKeyOf(ownerId)
        const existing = await this.store.roomByDirectKey(workspaceId, directKey)
        if (existing !== null) return existing.id
        const opened = await this.store.insertRoom({
            workspaceId,
            createdBy: ownerId,
            kind: "direct",
            name: null,
            directKey,
            others: [],
        })
        return opened.id
    }
}
