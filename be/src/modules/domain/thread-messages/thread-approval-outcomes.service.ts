import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkChainsService } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { pendingOf, settleCard, withVote } from "./approval-card.policy"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import type { ApprovalMessageRow, ThreadMessageRow } from "./persistence/thread-messages.rows"
import { FIND_MESSAGE_BY_APPROVAL, LOCK_MESSAGE, UPDATE_MESSAGE_APPROVAL } from "./persistence/thread-messages.sql"
import { toMessage } from "./thread.mapper"
import { ThreadMessagesService } from "./thread-messages.service"
import type { ApprovalCard, ApprovalResolved, ThreadMessage } from "./thread-messages.contracts"

/** The language of the lines a settled request writes when no person's screen asked for it (the deadline, another door). */
const RESOLVED_LINE_LOCALE: Locale = "vi"

/** How a card ended and who decided it. */
interface CardOutcome {
    readonly outcome: "approved" | "rejected" | "expired"
    readonly decidedBy: string | null
}

@Injectable()
/**
 * What happens to an approval card when its request ends: the card, the chain step and the thread are settled together and a refused
 * or expired ask goes back to the owner of the agent. It follows `approval.resolved` of the approval capability (the app root binds
 * it as that capability's events port), so it never asks the gate anything and the two capabilities do not wait on each other.
 */
export class ThreadApprovalOutcomesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly directory: MentionDirectoryService,
        private readonly threads: WorkThreadsService,
        private readonly chains: WorkChainsService,
        private readonly messages: ThreadMessagesService,
    ) {}

    /**
     * `approval.resolved`: the approval capability ended a request (a member's verdict, the deadline): settles the card that carries
     * it, with the decider's verdict on their line. A request no card carries, or a card already settled, is left as it is.
     */
    async resolved(event: ApprovalResolved): Promise<void> {
        const [found] = await this.entityManager.query<Array<ApprovalMessageRow>>(FIND_MESSAGE_BY_APPROVAL, [
            event.requestId,
        ])
        if (found === undefined) return
        await this.entityManager.transaction(async (tx) => {
            const locked = await this.lock(tx, found.workspace_id, found.id)
            const pending = pendingOf(locked)
            if (pending === null) return
            const card =
                event.decidedBy === null
                    ? pending.card
                    : withVote(pending.card, event.decidedBy, event.outcome === "approved" ? "approve" : "reject")
            await this.settle(tx, locked, card, event, RESOLVED_LINE_LOCALE)
        })
    }

    /** Locks the message of a card for the rest of the transaction. */
    async lock(tx: EntityManager, workspaceId: string, messageId: string): Promise<ThreadMessageRow> {
        const [row] = await tx.query<Array<ThreadMessageRow>>(LOCK_MESSAGE, [workspaceId, messageId])
        if (row === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MessageNotFound })
        return row
    }

    /** A vote that does not end the request: the card shows who voted. */
    async keep(tx: EntityManager, locked: ThreadMessageRow, card: ApprovalCard): Promise<ThreadMessage> {
        await tx.query(UPDATE_MESSAGE_APPROVAL, [locked.workspace_id, locked.id, JSON.stringify(card)])
        return toMessage({ ...locked, approval: card })
    }

    /** The request ended: the card says how and by whom, the chain step and the thread follow, and a bad end goes to the owner. */
    async settle(
        tx: EntityManager,
        locked: ThreadMessageRow,
        card: ApprovalCard,
        ending: CardOutcome,
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
