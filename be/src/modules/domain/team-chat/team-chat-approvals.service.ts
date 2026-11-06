import { Injectable } from "@nestjs/common"
import { ApprovalRequestsReadService } from "@modules/domain/approval-requests"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { approvalStateOf } from "./team-chat-approval.policy"
import type { ApprovalState } from "./team-chat.contracts"
import type { OptionalApprovalRequest, OptionalApprovalState } from "./team-chat-store.contracts"

@Injectable()
/** What the chat reads of the decisions core: the request an approval card is about and where each decision stands for a viewer. */
export class TeamChatApprovalsService {
    constructor(
        private readonly requests: ApprovalRequestsReadService,
        private readonly seats: WorkspaceMemberSeatsService,
    ) {}

    /** The request a decision card is about, with the group it stored; null when the workspace has no such request. */
    async requestOf(workspaceId: string, decisionId: string): Promise<OptionalApprovalRequest> {
        const card = await this.requests.cardOf(workspaceId, decisionId)
        return card === null
            ? null
            : {
                  id: card.id,
                  action: card.action,
                  amount: card.amount,
                  unit: card.unit,
                  requestedByAgentId: card.requestedByAgentId,
                  storedGroup: card.approverGroup,
              }
    }

    /** Where each decision stands for the viewer: pending, approved, refused or expired, who settled it, and whether the viewer may. */
    async statesOf(
        workspaceId: string,
        viewerId: string,
        decisionIds: ReadonlyArray<string>,
    ): Promise<Map<string, ApprovalState>> {
        if (decisionIds.length === 0) return new Map()
        const [viewer, standings] = await Promise.all([
            this.seats.activeSeatOfUser(workspaceId, viewerId),
            this.requests.standingOf(workspaceId, [...new Set(decisionIds)]),
        ])
        const settlerIds = standings.flatMap((standing) => (standing.resolvedBy === null ? [] : [standing.resolvedBy]))
        const settlers = await this.seats.seatsByIds(workspaceId, settlerIds, settlerIds.length)
        const names = new Map(settlers.map((seat) => [seat.memberId, seat.displayName]))
        return new Map(
            standings.map((standing) => [standing.id, approvalStateOf(standing, viewer?.memberId ?? null, names)]),
        )
    }

    /** Where one decision stands for the viewer; null when the workspace has no such request. */
    async stateOf(workspaceId: string, viewerId: string, decisionId: string): Promise<OptionalApprovalState> {
        return (await this.statesOf(workspaceId, viewerId, [decisionId])).get(decisionId) ?? null
    }
}
