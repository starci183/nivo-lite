import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { APPROVAL_RESOLVED_OUTCOMES, memberOf } from "@modules/events/api"
import { WorkChainsService } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { pendingOf, settleCard, withVote } from "./approval-card.policy"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadMessageAuthorsService } from "./thread-message-authors.service"
import { ThreadMessageEntity } from "./persistence/entities"
import { selectMessageColumns } from "./persistence/thread-message.query"
import { toMessage } from "./thread.mapper"
import { ThreadMessagesService } from "./thread-messages.service"
import type {
    ApprovalCard,
    ApprovalResolved,
    InboxClaim,
    ThreadMessage,
    ThreadMessageRead,
    ThreadMessageRecord,
} from "./thread-messages.contracts"

/** The language of the lines a settled request writes when no person's screen asked for it (the deadline, another door). */
const RESOLVED_LINE_LOCALE: Locale = "vi"

/** How a card ended and who decided it. */
interface CardOutcome {
    readonly outcome: "approved" | "rejected" | "expired"
    readonly decidedBy: string | null
}

/** The verdict that ended a request a member decided: an approval, or a refusal. */
const verdictOf = (event: ApprovalResolved): "approve" | "reject" =>
    event.outcome === "approved" ? "approve" : "reject"

@Injectable()
/**
 * What happens to an approval card when its request ends: the card, the chain step and the thread are settled together and a refused
 * or expired ask goes back to the owner of the agent. It is the `thread_outcomes` reactor of `approval_resolved`: the approval
 * capability publishes the event in the transaction that ends a request, so a failure here is retried by the bus and never strands
 * the card, and the two capabilities do not wait on each other.
 */
export class ThreadApprovalOutcomesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly directory: MentionDirectoryService,
        private readonly authors: ThreadMessageAuthorsService,
        private readonly threads: WorkThreadsService,
        private readonly chains: WorkChainsService,
        private readonly messages: ThreadMessagesService,
    ) {}

    /**
     * `approval_resolved`: the approval capability ended a request (a member's verdict, the deadline): settles the card that carries
     * it, with the decider's verdict on their line. A request no card carries, or a card already settled, is left as it is. The
     * delivery is claimed in the inbox in the transaction of the effect, so a redelivery settles nothing twice.
     */
    async resolved(event: ApprovalResolved, claim: InboxClaim): Promise<void> {
        const outcome = memberOf(APPROVAL_RESOLVED_OUTCOMES, event.outcome, "outcome")
        const found = await this.entityManager.findOne(ThreadMessageEntity, {
            select: { id: true, workspaceId: true },
            where: { approvalRequestId: event.requestId },
        })
        if (found === null) return
        await this.entityManager.transaction(async (tx) => {
            if (!(await this.inbox.claim(claim.consumer, claim.dedupeKey, tx))) return
            const locked = await this.lock(tx, found.workspaceId, found.id)
            const pending = pendingOf(locked)
            if (pending === null) return
            const card =
                event.decidedBy === null ? pending.card : withVote(pending.card, event.decidedBy, verdictOf(event))
            await this.settle(tx, locked, card, { outcome, decidedBy: event.decidedBy }, RESOLVED_LINE_LOCALE)
        })
    }

    /** Locks the message of a card for the rest of the transaction. */
    async lock(tx: EntityManager, workspaceId: string, messageId: string): Promise<ThreadMessageRecord> {
        const row = await selectMessageColumns(tx.createQueryBuilder(ThreadMessageEntity, "m"), workspaceId)
            .andWhere("m.id = :messageId", { messageId })
            .limit(1)
            .setLock("pessimistic_write", undefined, ["m"])
            .getRawOne<ThreadMessageRead>()
        if (row === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MessageNotFound })
        return this.authors.withAuthor(tx, workspaceId, row)
    }

    /** A vote that does not end the request: the card shows who voted. */
    async keep(tx: EntityManager, locked: ThreadMessageRecord, card: ApprovalCard): Promise<ThreadMessage> {
        await tx.update(ThreadMessageEntity, { workspaceId: locked.workspace_id, id: locked.id }, { approval: card })
        return toMessage({ ...locked, approval: card })
    }

    /** The request ended: the card says how and by whom, the chain step and the thread follow, and a bad end goes to the owner. */
    async settle(
        tx: EntityManager,
        locked: ThreadMessageRecord,
        card: ApprovalCard,
        ending: CardOutcome,
        locale: Locale,
    ): Promise<ThreadMessage> {
        const workspaceId = locked.workspace_id
        const decidedByName =
            ending.decidedBy === null ? null : await this.directory.nameOfMember(tx, workspaceId, ending.decidedBy)
        const settled = settleCard(card, { ...ending, decidedByName }, this.clock.now())
        await tx.update(ThreadMessageEntity, { workspaceId, id: locked.id }, { approval: settled })
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
        locked: ThreadMessageRecord,
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
