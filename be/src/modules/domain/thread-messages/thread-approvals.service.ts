import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isDomainError } from "@modules/platform/errors"
import { pendingOf, withVote } from "./approval-card.policy"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadMessageAuthorsService } from "./thread-message-authors.service"
import { selectMessages } from "./persistence/thread-message.query"
import { toMessage } from "./thread.mapper"
import { ThreadApprovalOutcomesService } from "./thread-approval-outcomes.service"
import type { ThreadCardDecision, ThreadMessage, ThreadMessageRead } from "./thread-messages.contracts"
import { InjectApprovalGate } from "./thread-messages.decorators"
import type { ThreadApprovalGate } from "./thread-messages.port"

/** The code the approval capability refuses with when the request ran out of time before this answer; the card shows it as closed. */
const REQUEST_EXPIRED = "APPROVAL_REQUESTS_EXPIRED"

@Injectable()
/**
 * The approval cards of work threads as members decide them. The approval capability's `approval.resolved` reaches the cards through
 * ThreadApprovalOutcomesService, which may settle the card while the gate answers; the decision then shows what it wrote.
 */
export class ThreadApprovalsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectApprovalGate() private readonly gate: ThreadApprovalGate,
        private readonly members: WorkspaceMembersService,
        private readonly directory: MentionDirectoryService,
        private readonly authors: ThreadMessageAuthorsService,
        private readonly outcomes: ThreadApprovalOutcomesService,
    ) {}

    /**
     * A member approves or rejects the card of a message. The server checks the member is among the people tagged and leaves the
     * authority check, the policy and the one-winner lock to the approval capability; the card then shows what it answered.
     */
    async decide(input: ThreadCardDecision): Promise<ThreadMessage> {
        await this.members.require(input.userId, input.workspaceId)
        const memberId = await this.directory.memberIdOf(this.entityManager, input.workspaceId, input.userId)
        const read = await selectMessages(this.entityManager, input.workspaceId)
            .andWhere("m.id = :messageId", { messageId: input.messageId })
            .limit(1)
            .getRawOne<ThreadMessageRead>()
        if (read === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MessageNotFound })
        const row = await this.authors.withAuthor(this.entityManager, input.workspaceId, read)
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
        const result = await this.gate
            .decide({ requestId: card.requestId, memberId, verdict: input.verdict })
            .catch((error: unknown) => {
                // The deadline can pass before the approval event settles the card: the member still sees the closed card, not the other capability's code.
                if (isDomainError(error) && error.code === REQUEST_EXPIRED) {
                    throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.ApprovalClosed, cause: error })
                }
                throw error
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
