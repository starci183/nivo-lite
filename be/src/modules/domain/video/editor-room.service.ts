import { Injectable } from "@nestjs/common"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import type { WorkContext } from "@modules/domain/decisions"
import type { EditorCard } from "./editor-delegation.contracts"

/** The module whose agent speaks AI Editor's lines (the video module). */
const EDITOR_DEPARTMENT = "video"

@Injectable()
/**
 * Where AI Editor talks to the owner: the one-line preview of a card, or a plain line, spoken by the video agent in their direct room
 * (the team chat has text lines only: the card itself is not posted).
 */
export class EditorRoomService {
    constructor(private readonly chat: TeamChatRoomsService) {}

    /** Says the preview line of a card; answers the id of the line, or null when the workspace has no video agent. */
    async post(scope: WorkContext, preview: string, _card: EditorCard, _workItemId: string): Promise<string | null> {
        return (await this.line(scope, preview))?.messageId ?? null
    }

    /** Says a plain line of AI Editor. */
    async say(scope: WorkContext, body: string, _workItemId: string): Promise<void> {
        await this.line(scope, body)
    }

    private line(scope: WorkContext, body: string): ReturnType<TeamChatRoomsService["postAsAgent"]> {
        return this.chat.postAsAgent(scope.workspaceId, { agent: EDITOR_DEPARTMENT, toUserId: null, body, key: null })
    }
}
