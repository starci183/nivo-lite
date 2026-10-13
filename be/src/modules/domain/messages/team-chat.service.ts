import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { PostedMessage } from "./messages.contracts"
import { INSERT_HUMAN_MESSAGE } from "./persistence/team-chat.sql"

@Injectable()
/** The lines a member types in the Office thread: written as the member (their display name and staff row), after membership is proved. */
export class TeamChatService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Posts the line as the caller and answers the stored line; any member of the workspace may speak. */
    async postHuman(principalId: string, workspaceId: string, body: string): Promise<PostedMessage> {
        const member = await this.members.require(principalId, workspaceId)
        const [row] = await this.entityManager.query<[PostedMessage]>(INSERT_HUMAN_MESSAGE, [
            workspaceId,
            member.displayName,
            member.staffId,
            body.trim(),
        ])
        return row
    }
}
