import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkChainsService } from "@modules/domain/work-chains"
import type { ChainActor } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder, unwrapOutcome } from "@modules/platform/primitives"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { vetMentions, vetQuotes } from "./mention.policy"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadMessageEntity } from "./persistence/entities"
import { readMessageById } from "./persistence/thread-message.query"
import { toMessage } from "./thread.mapper"
import { tagStepOf } from "./thread-step.policy"
import { stepTitleOf } from "./thread-text.policy"
import type {
    AgentGate,
    MemberPost,
    MentionView,
    ThreadLine,
    ThreadMessage,
    UserPost,
} from "./thread-messages.contracts"
import { InjectAgentRules } from "./thread-messages.decorators"
import type { AgentRules } from "./thread-messages.port"

@Injectable()
/** What members write in a work thread, with the tags they chose; the only writer of thread_messages. */
export class ThreadMessagesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAgentRules() private readonly rules: AgentRules,
        private readonly members: WorkspaceMembersService,
        private readonly directory: MentionDirectoryService,
        private readonly threads: WorkThreadsService,
        private readonly chains: WorkChainsService,
    ) {}

    /**
     * A member writes. The tags are the list the member chose, never read out of the text: tagging a person needs no permission,
     * giving an agent work needs the agents capability's say-so. Whoever the member answers is done waiting.
     */
    async postAsUser(post: UserPost): Promise<ThreadMessage> {
        await this.members.require(post.userId, post.workspaceId)
        const memberId = await this.directory.memberIdOf(this.entityManager, post.workspaceId, post.userId)
        return this.postAsMember({
            workspaceId: post.workspaceId,
            threadId: post.threadId,
            memberId,
            body: post.body,
            mentions: post.mentions,
            quoted: post.quoted,
            locale: post.locale,
        })
    }

    /** The same as {@link postAsUser} for a member id the caller already proved is an active member of the workspace; it joins the caller's transaction when it hands one. */
    postAsMember(post: MemberPost, manager?: EntityManager): Promise<ThreadMessage> {
        const author: ChainActor = { kind: "member", id: post.memberId }
        const run = async (tx: EntityManager): Promise<ThreadMessage> => {
            const mentions = unwrapOutcome(vetMentions(post.mentions), ThreadMessagesError)
            const quoted = unwrapOutcome(vetQuotes(post.quoted), ThreadMessagesError)
            await this.threads.lock(tx, post.workspaceId, post.threadId)
            const views = await this.directory.resolve(tx, post.workspaceId, mentions, post.locale)
            await this.proveAgents(
                views,
                (agentId) => this.rules.canAssign(post.memberId, agentId),
                ThreadMessagesErrorCode.AssignNotAllowed,
            )
            const message = await this.append(tx, {
                workspaceId: post.workspaceId,
                threadId: post.threadId,
                author,
                body: post.body,
                quoted,
                mentions: views,
                card: null,
            })
            await this.chains.settleFor(post.workspaceId, post.threadId, author, tx)
            await eachInOrder(views, (view) =>
                this.chains.record(
                    tagStepOf(
                        post,
                        author,
                        view.kind === "agent" ? "assign" : "hand_off",
                        stepTitleOf(null, post.body),
                        view,
                    ),
                    tx,
                ),
            )
            await this.threads.setStatus(tx, post.workspaceId, post.threadId, "open")
            return message
        }
        return manager === undefined ? this.entityManager.transaction(run) : run(manager)
    }

    /** Writes one line into a thread inside the caller's transaction and reads it back. */
    async append(tx: EntityManager, line: ThreadLine): Promise<ThreadMessage> {
        const card = line.card
        const result = await tx
            .createQueryBuilder(ThreadMessageEntity, "t")
            .insert()
            .values({
                workspaceId: line.workspaceId,
                threadId: line.threadId,
                authorKind: line.author.kind,
                authorId: line.author.id,
                body: line.body,
                quoted: line.quoted,
                mentions: line.mentions,
                approval: card,
                approvalRequestId: card === null ? null : card.requestId,
            })
            .returning("id")
            .execute()
        const [inserted] = result.raw as Array<{ id: string }>
        if (inserted === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.NotStored })
        const row = await readMessageById(tx, line.workspaceId, inserted.id)
        if (row === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.NotStored })
        return toMessage(row)
    }

    /** Asks the agents capability about every agent the message tags and refuses at the first one it does not allow. */
    proveAgents(
        views: ReadonlyArray<MentionView>,
        allowed: AgentGate,
        refusal: ThreadMessagesErrorCode,
    ): Promise<void> {
        return eachInOrder(
            views.filter((view) => view.kind === "agent"),
            async (view) => {
                if (!(await allowed(view.id))) {
                    throw new ThreadMessagesError({ code: refusal, params: { agent: view.name } })
                }
            },
        )
    }
}
