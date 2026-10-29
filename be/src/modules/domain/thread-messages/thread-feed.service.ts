import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkChainsService } from "@modules/domain/work-chains"
import type { ChainView } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import type { WorkThreadLeadFilter, WorkThread } from "@modules/domain/work-threads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { Connection, PageRequest } from "@modules/platform/pagination"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadMessageAuthorsService } from "./thread-message-authors.service"
import { ThreadMessageEntity } from "./persistence/entities"
import { selectMessages } from "./persistence/thread-message.query"
import { toListing, toMessage } from "./thread.mapper"
import type {
    NewThread,
    ThreadDigestRecord,
    ThreadListing,
    ThreadMessageRead,
    ThreadView,
} from "./thread-messages.contracts"

/** How many threads one digest read covers. */
const DIGEST_PAGE = 200

/** How many of the newest messages a thread read answers. */
const MESSAGE_PAGE = 200

@Injectable()
/** What a member sees of the work threads: the list with each newest line, one thread with its messages, and its chain. */
export class ThreadFeedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly directory: MentionDirectoryService,
        private readonly authors: ThreadMessageAuthorsService,
        private readonly threads: WorkThreadsService,
        private readonly chains: WorkChainsService,
    ) {}

    /** Opens a thread for a member of the workspace, optionally about one lead or one order of it. */
    async open(input: NewThread): Promise<WorkThread> {
        await this.members.require(input.userId, input.workspaceId)
        const memberId = await this.directory.memberIdOf(this.entityManager, input.workspaceId, input.userId)
        return this.threads.createFor({
            workspaceId: input.workspaceId,
            memberId,
            title: input.title,
            leadId: input.leadId,
            orderId: input.orderId,
        })
    }

    /** The newest threads of the workspace with their newest line, optionally only those about one lead. */
    async list(
        userId: string,
        workspaceId: string,
        leadId: WorkThreadLeadFilter,
        request: PageRequest = {},
    ): Promise<Connection<ThreadListing>> {
        await this.members.require(userId, workspaceId)
        const threads = await this.threads.list(workspaceId, leadId, request)
        const digests = await this.entityManager
            .createQueryBuilder(ThreadMessageEntity, "m")
            .select([
                "m.thread_id AS thread_id",
                "(array_agg(m.body ORDER BY m.created_at DESC, m.id DESC))[1] AS last_body",
                "max(m.created_at) AS last_at",
                "count(*)::int AS message_count",
                "COALESCE(bool_or(m.approval ->> 'outcome' = 'pending'), false) AS waiting_approval",
            ])
            .where("m.workspace_id = :workspaceId AND m.thread_id = ANY(:threadIds)", {
                workspaceId,
                threadIds: threads.nodes.map((thread) => thread.id),
            })
            .groupBy("m.thread_id")
            .limit(DIGEST_PAGE)
            .getRawMany<ThreadDigestRecord>()
        const byThread = new Map(digests.map((digest) => [digest.thread_id, digest]))
        return {
            nodes: threads.nodes.map((thread) => toListing(thread, byThread.get(thread.id))),
            pageInfo: threads.pageInfo,
        }
    }

    /** One thread with its newest messages, oldest first. */
    async read(userId: string, workspaceId: string, threadId: string): Promise<ThreadView> {
        await this.members.require(userId, workspaceId)
        const thread = await this.threads.find(workspaceId, threadId)
        const read = await selectMessages(this.entityManager, workspaceId)
            .andWhere("m.thread_id = :threadId", { threadId })
            .orderBy("m.created_at", "DESC")
            .addOrderBy("m.id", "DESC")
            .limit(MESSAGE_PAGE)
            .getRawMany<ThreadMessageRead>()
        const newestFirst = await this.authors.withAuthors(this.entityManager, workspaceId, read)
        return { thread, messages: newestFirst.map(toMessage).reverse() }
    }

    /** The chain of one thread: its steps in order and the summary line, for a member of the workspace. */
    async chain(userId: string, workspaceId: string, threadId: string): Promise<ChainView> {
        await this.members.require(userId, workspaceId)
        await this.threads.find(workspaceId, threadId)
        return this.chains.view(workspaceId, threadId)
    }
}
