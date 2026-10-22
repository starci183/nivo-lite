import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { pendingOf, withVote } from "./approval-card.policy"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import type { ThreadMessageRow } from "./persistence/thread-messages.rows"
import { FIND_MESSAGE } from "./persistence/thread-messages.sql"
import { toMessage } from "./thread.mapper"
import { ThreadApprovalOutcomesService } from "./thread-approval-outcomes.service"
import type { CardDecision, ThreadMessage } from "./thread-messages.contracts"
import { InjectApprovalGate } from "./thread-messages.decorators"
import type { ApprovalGate } from "./thread-messages.port"

@Injectable()
/**
 * The approval cards of work threads as members decide them. The approval capability's `approval.resolved` reaches the cards through
 * ThreadApprovalOutcomesService, which may settle the card while the gate answers; the decision then shows what it wrote.
 */
export class ThreadApprovalsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectApprovalGate() private readonly gate: ApprovalGate,
        private readonly members: WorkspaceMembersService,
        private readonly directory: MentionDirectoryService,
        private readonly outcomes: ThreadApprovalOutcomesService,
    ) {}

    /**
     * A member approves or rejects the card of a message. The server checks the member is among the people tagged and leaves the
     * authority check, the policy and the one-winner lock to the approval capability; the card then shows what it answered.
     */
    async decide(input: CardDecision): Promise<ThreadMessage> {
        await this.members.require(input.userId, input.workspaceId)
        const memberId = await this.directory.memberIdOf(this.entityManager, input.workspaceId, input.userId)
        const [row] = await this.entityManager.query<Array<ThreadMessageRow>>(FIND_MESSAGE, [
            input.workspaceId,
            input.messageId,
        ])
        if (row === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MessageNotFound })
        const card = row.approval
        if (card === null) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.NoApproval })
        if (card.outcome === "expired") throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.ApprovalClosed })
        if (card.outcome !== "pending") {
            throw new ThreadMessagesError({
                code: ThreadMessagesErrorCode.AlreadyDecided,
                params: { name: card.decidedByName ?? "", at: card.decidedAt ?? "" },
            })
        }
        if (!card.approvers.some((approver) => approver.memberId === memberId)) {
            throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.NotApprover })
        }
        const result = await this.gate.decide({
            requestId: card.requestId,
            memberId,
            verdict: input.verdict,
        })
        return this.entityManager.transaction(async (tx) => {
            const locked = await this.outcomes.lock(tx, input.workspaceId, input.messageId)
            const pending = pendingOf(locked)
            if (pending === null) return toMessage(locked)
            const voted = withVote(pending.card, memberId, input.verdict)
            if (result.status === "pending") return this.outcomes.keep(tx, locked, voted)
            return this.outcomes.settle(
                tx,
                locked,
                voted,
                { outcome: result.status, decidedBy: memberId },
                input.locale,
            )
        })
    }
}
