import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ChatActivityService, chatActivityTarget } from "@modules/domain/chat-activity"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { MessagesError, MessagesErrorCode } from "./errors/messages.error"
import type { PostedMessage } from "./messages.contracts"
import type { OptionalRoom, RoomKeyText } from "./office-cards.contracts"
import { isOfficeRoomKey } from "./office-card.policy"
import { postedMessageOf } from "./posted-rows.policy"
import { MessageEntity } from "./persistence/entities"

/** The columns the insert answers; the timestamps and ids keep the text shape the contract always had. */
const POSTED_COLUMNS = `id, author_kind, author_name, author_user_id::text AS author_user_id, agent_id, staff_id, body, lead_id,
    work_item_id, room, to_json(created_at) #>> '{}' AS created_at`

@Injectable()
/** The lines a member types in the Office thread: written as the member (their display name and staff row), after membership is proved. */
export class TeamChatService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly activity: ChatActivityService,
    ) {}

    /** Posts the line as the caller in a room (null = the Office room) and answers the stored line; any member may speak. It joins the caller's transaction when it hands one. */
    async postHuman(
        principalId: string,
        workspaceId: string,
        body: string,
        room: RoomKeyText = null,
        manager: EntityManager = this.entityManager,
    ): Promise<PostedMessage> {
        const member = await this.members.require(principalId, workspaceId)
        const target: OptionalRoom = room === null || isOfficeRoomKey(room) ? room : this.unknownRoom(room)
        const result = await manager
            .createQueryBuilder(MessageEntity, "m")
            .insert()
            .values({
                workspaceId,
                authorKind: "human",
                authorName: member.displayName,
                staffId: member.staffId,
                body: body.trim(),
                room: target,
                authorUserId: member.userId,
            })
            .returning(POSTED_COLUMNS)
            .execute()
        const row = postedMessageOf(result.raw)
        if (row === undefined) throw new MessagesError({ code: MessagesErrorCode.LineNotStored })
        await this.activity.message(
            workspaceId,
            chatActivityTarget({ room: target, conversationId: null }),
            member.userId,
            manager,
        )
        return row
    }

    private unknownRoom(room: string): never {
        throw new MessagesError({ code: MessagesErrorCode.RoomInvalid, params: { room } })
    }
}
