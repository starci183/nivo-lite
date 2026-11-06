import { Injectable } from "@nestjs/common"
import { TeamChatService } from "@modules/domain/team-chat"
import type { HubCardPayload } from "./accounting-desk.contracts"

/** The module whose agent (AI Ke toan) speaks to the owner. */
export const ACCOUNTING_DEPARTMENT = "accounting"

@Injectable()
/** The adapter to the team chat for the accounting desk: lines the accounting agent says to the owner in their direct room. */
export class AccountingRoomService {
    constructor(private readonly chat: TeamChatService) {}

    /** Says one line as AI Ke toan to the owner; nothing happens when the workspace has no accounting agent. */
    async post(workspaceId: string, body: string): Promise<void> {
        await this.chat.postAsAgent(workspaceId, {
            agent: ACCOUNTING_DEPARTMENT,
            toUserId: null,
            body,
            key: null,
        })
    }

    /** Says the plain text of a result card to the owner (the team chat has text, report and approval lines only) and answers the card. */
    async postCard(workspaceId: string, card: HubCardPayload, text: string): Promise<HubCardPayload> {
        await this.post(workspaceId, text)
        return card
    }
}
