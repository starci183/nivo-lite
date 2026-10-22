import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkChainsService } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { pendingOf, settleCard, withVote } from "./approval-card.policy"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import type { ApprovalMessageRow, ThreadMessageRow } from "./persistence/thread-messages.rows"
import {
    FIND_MESSAGE,
    FIND_MESSAGE_BY_APPROVAL,
    LOCK_MESSAGE,
    UPDATE_MESSAGE_APPROVAL,
} from "./persistence/thread-messages.sql"
import { toMessage } from "./thread.mapper"
import { ThreadMessagesService } from "./thread-messages.service"
import type { ApprovalCard, ApprovalResolved, CardDecision, ThreadMessage } from "./thread-messages.contracts"
import { InjectApprovalGate } from "./thread-messages.decorators"
import type { ApprovalGate } from "./thread-messages.port"

/** How a card ended and who decided it. */
interface Ending {
    readonly outcome: "approved" | "rejected" | "expired"
    readonly decidedBy: string | null
}

@Injectable()
/** The approval cards of work threads: members decide them, and the approval capability's result settles them. */
export class ThreadApprovalsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectApprovalGate() private readonly gate: ApprovalGate,
        private readonly members: WorkspaceMembersService,
        private readonly directory: MentionDirectoryService,
        private readonly threads: WorkThreadsService,
        private readonly chains: WorkChainsService,
        private readonly messages: ThreadMessagesService,
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
            const locked = await this.lock(tx, input.workspaceId, input.messageId)
            const pending = pendingOf(locked)
            if (pending === null) return toMessage(locked)
            const voted = withVote(pending.card, memberId, input.verdict)
            if (result.outcome === "pending") return this.keep(tx, locked, voted)
            return this.settle(
                tx,
                locked,
                voted,
                { outcome: result.outcome, decidedBy: result.decidedBy ?? memberId },
                input.locale,
            )
        })
    }

    /**
     * The approval capability ended a request on its own (a decision elsewhere, or the deadline): settles the card and the chain
     * step and, when it was refused or expired, sends the work back to the agent's owner. Answers whether a card belonged to it.
     */
    async applyResolved(event: ApprovalResolved, locale: Locale): Promise<boolean> {
        const [found] = await this.entityManager.query<Array<ApprovalMessageRow>>(FIND_MESSAGE_BY_APPROVAL, [
            event.requestId,
        ])
        if (found === undefined) return false
        await this.entityManager.transaction(async (tx) => {
            const locked = await this.lock(tx, found.workspace_id, found.id)
            const pending = pendingOf(locked)
            if (pending === null) return
            await this.settle(tx, locked, pending.card, event, locale)
        })
        return true
    }

    private async lock(tx: EntityManager, workspaceId: string, messageId: string): Promise<ThreadMessageRow> {
        const [row] = await tx.query<Array<ThreadMessageRow>>(LOCK_MESSAGE, [workspaceId, messageId])
        if (row === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MessageNotFound })
        return row
    }

    /** A vote that does not end the request: the card shows who voted. */
    private async keep(tx: EntityManager, locked: ThreadMessageRow, card: ApprovalCard): Promise<ThreadMessage> {
        await tx.query(UPDATE_MESSAGE_APPROVAL, [locked.workspace_id, locked.id, JSON.stringify(card)])
        return toMessage({ ...locked, approval: card })
    }

    private async settle(
        tx: EntityManager,
        locked: ThreadMessageRow,
        card: ApprovalCard,
        ending: Ending,
        locale: Locale,
    ): Promise<ThreadMessage> {
        const workspaceId = locked.workspace_id
        const decidedByName =
            ending.decidedBy === null ? null : await this.directory.nameOfMember(tx, workspaceId, ending.decidedBy)
        const settled = settleCard(card, { ...ending, decidedByName }, this.clock.now())
        await tx.query(UPDATE_MESSAGE_APPROVAL, [workspaceId, locked.id, JSON.stringify(settled)])
        await this.chains.settleApproval(
            {
                workspaceId,
                approvalRequestId: card.requestId,
                outcome: ending.outcome,
                decidedBy: ending.decidedBy,
                locale,
            },
            tx,
        )
        await this.threads.setStatus(
            tx,
            workspaceId,
            locked.thread_id,
            ending.outcome === "approved" ? "open" : "stopped",
        )
        if (ending.outcome !== "approved") await this.returnToOwner(tx, locked, settled, ending.outcome, locale)
        return toMessage({ ...locked, approval: settled })
    }

    /** A refused or expired ask goes back to the person who answers for the agent: the agent says so and tags them. */
    private async returnToOwner(
        tx: EntityManager,
        locked: ThreadMessageRow,
        card: ApprovalCard,
        outcome: "rejected" | "expired",
        locale: Locale,
    ): Promise<void> {
        const workspaceId = locked.workspace_id
        const owner = await this.chains.ownerTagOf(workspaceId, locked.author_id, tx)
        const ownerName = await this.directory.nameOfMember(tx, workspaceId, owner.id)
        await this.messages.append(tx, {
            workspaceId,
            threadId: locked.thread_id,
            author: { kind: "agent", id: locked.author_id },
            body: this.catalog.get(
                `thread.owner.${outcome}`,
                { agent: locked.author_name, action: card.action },
                locale,
            ),
            quoted: [],
            mentions: [{ ...owner, name: ownerName }],
            card: null,
        })
        await this.chains.record(
            {
                workspaceId,
                threadId: locked.thread_id,
                actor: { kind: "agent", id: locked.author_id },
                kind: "hand_off",
                action: this.catalog.get("thread.owner.step", { action: card.action }, locale),
                detail: "",
                rule: card.rule,
                target: owner,
                approvalRequestId: null,
                locale,
            },
            tx,
        )
    }
}
