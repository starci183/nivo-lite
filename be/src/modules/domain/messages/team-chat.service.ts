import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ChatActivityService, chatActivityTarget } from "@modules/domain/chat-activity"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { MessagesError, MessagesErrorCode } from "./errors/messages.error"
import type { PostedMessage } from "./messages.contracts"
import type { OptionalRoom, RoomKeyText } from "./office-cards.contracts"
import { isOfficeRoomKey } from "./office-card.policy"
import { INSERT_HUMAN_MESSAGE } from "./persistence/team-chat.sql"

@Injectable()
/** The lines a member types in the Office thread: written as the member (their display name and staff row), after membership is proved. */
export class TeamChatService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly activity: ChatActivityService,
    ) {}

    /** Posts the line as the caller in a room (null = the Office room) and answers the stored line; any member may speak. */
    async postHuman(
        principalId: string,
        workspaceId: string,
        body: string,
        room: RoomKeyText = null,
    ): Promise<PostedMessage> {
        const member = await this.members.require(principalId, workspaceId)
        const target: OptionalRoom = room === null || isOfficeRoomKey(room) ? room : this.unknownRoom(room)
        const [row] = await this.entityManager.query<[PostedMessage]>(INSERT_HUMAN_MESSAGE, [
            workspaceId,
            member.displayName,
            member.staffId,
            body.trim(),
            target,
            member.userId,
        ])
        await this.activity.message(
            workspaceId,
            chatActivityTarget({ room: target, conversationId: null }),
            member.userId,
        )
        return row
    }

    private unknownRoom(room: string): never {
        throw new MessagesError({ code: MessagesErrorCode.RoomInvalid, params: { room } })
    }
}
