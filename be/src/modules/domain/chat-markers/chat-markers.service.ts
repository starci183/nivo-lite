import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { isOfficeRoomKey } from "@modules/domain/messages"
import { OfficeReadMarkersService } from "@modules/domain/office-rooms"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChatMarkerState, ChatTarget } from "./chat-markers.contracts"
import { ChatMarkersError, ChatMarkersErrorCode } from "./errors/chat-markers.error"
import type { ChatCursorRow, ChatStateRow, ChatTargetRow } from "./persistence/chat-markers.rows"
import {
    CHAT_MARKER_STATE,
    CHAT_MESSAGE_CURSOR,
    CHAT_TARGET_MEMBER,
    MARK_CHAT_DELIVERED,
    MARK_CHAT_READ,
    SET_CHAT_MUTED,
} from "./persistence/chat-markers.sql"

@Injectable()
/** Authenticated per-member chat receipts; marker cursors never include a message newer than the acknowledged fetch. */
export class ChatMarkersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly roomReads: OfficeReadMarkersService,
    ) {}

    /** The same target admission used by receipt writes and typing broadcasts. */
    async requireTarget(principalId: string, workspaceId: string, target: ChatTarget): Promise<WorkspaceMember> {
        const member = await this.members.require(principalId, workspaceId)
        if (target.room !== null && (target.conversationId !== null || !isOfficeRoomKey(target.room)))
            throw new ChatMarkersError({ code: ChatMarkersErrorCode.TargetNotFound })
        const [row] = await this.entityManager.query<Array<ChatTargetRow>>(CHAT_TARGET_MEMBER, [
            workspaceId,
            member.userId,
            target.room,
            target.conversationId,
        ])
        if (row?.allowed !== true) throw new ChatMarkersError({ code: ChatMarkersErrorCode.TargetNotFound })
        return member
    }

    /** The preference and receipt beneath this account's newest authored message. */
    async state(principalId: string, workspaceId: string, target: ChatTarget): Promise<ChatMarkerState> {
        const member = await this.requireTarget(principalId, workspaceId, target)
        const [row] = await this.entityManager.query<[ChatStateRow]>(CHAT_MARKER_STATE, [
            workspaceId,
            member.userId,
            target.room,
            target.conversationId,
        ])
        return { muted: row.muted, lastOwnMessage: row.last_own_message }
    }

    /** Acknowledges the newest message a client actually fetched, independently of whether it displayed it. */
    async markDelivered(
        principalId: string,
        workspaceId: string,
        target: ChatTarget,
        messageId: string,
    ): Promise<void> {
        const params = await this.receiptParams(principalId, workspaceId, target, messageId)
        await this.entityManager.query(MARK_CHAT_DELIVERED, params)
    }

    /** Acknowledges a displayed message; a read cursor also proves delivery and preserves room read compatibility. */
    async markRead(principalId: string, workspaceId: string, target: ChatTarget, messageId: string): Promise<void> {
        const params = await this.receiptParams(principalId, workspaceId, target, messageId)
        await this.entityManager.transaction(async (manager) => {
            await manager.query(MARK_CHAT_READ, params)
            if (target.conversationId === null)
                await this.roomReads.advance(workspaceId, params[1], target.room ?? "", params[4], manager)
        })
    }

    /** Changes only the proven caller's preference for this target. */
    async mute(principalId: string, workspaceId: string, target: ChatTarget, muted: boolean): Promise<void> {
        const member = await this.requireTarget(principalId, workspaceId, target)
        await this.entityManager.query(SET_CHAT_MUTED, [
            workspaceId,
            member.userId,
            target.room ?? "",
            target.conversationId,
            muted,
        ])
    }

    private async receiptParams(
        principalId: string,
        workspaceId: string,
        target: ChatTarget,
        messageId: string,
    ): Promise<[string, string, string, string | null, string, string]> {
        const member = await this.requireTarget(principalId, workspaceId, target)
        const [cursor] = await this.entityManager.query<Array<ChatCursorRow>>(CHAT_MESSAGE_CURSOR, [
            workspaceId,
            target.room,
            target.conversationId,
            messageId,
        ])
        if (cursor === undefined) throw new ChatMarkersError({ code: ChatMarkersErrorCode.MessageNotFound })
        return [workspaceId, member.userId, target.room ?? "", target.conversationId, cursor.created_at, messageId]
    }
}
