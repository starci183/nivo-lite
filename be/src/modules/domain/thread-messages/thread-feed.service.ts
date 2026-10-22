import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkChainsService } from "@modules/domain/work-chains"
import type { ChainView } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import type { WorkThreadLeadFilter, WorkThread } from "@modules/domain/work-threads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { MentionDirectoryService } from "./mention-directory.service"
import type { ThreadDigestRow, ThreadMessageRow } from "./persistence/thread-messages.rows"
import { LIST_MESSAGES, LIST_THREAD_DIGESTS } from "./persistence/thread-messages.sql"
import { toListing, toMessage } from "./thread.mapper"
import type { NewThread, ThreadListing, ThreadView } from "./thread-messages.contracts"

/** How many of the newest messages a thread read answers. */
const MESSAGE_PAGE = 200

@Injectable()
/** What a member sees of the work threads: the list with each newest line, one thread with its messages, and its chain. */
export class ThreadFeedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly directory: MentionDirectoryService,
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
    ): Promise<ReadonlyArray<ThreadListing>> {
        await this.members.require(userId, workspaceId)
        const threads = await this.threads.list(workspaceId, leadId)
        const digests = await this.entityManager.query<Array<ThreadDigestRow>>(LIST_THREAD_DIGESTS, [
            workspaceId,
            threads.map((thread) => thread.id),
        ])
        const byThread = new Map(digests.map((digest) => [digest.thread_id, digest]))
        return threads.map((thread) => toListing(thread, byThread.get(thread.id)))
    }

    /** One thread with its newest messages, oldest first. */
    async read(userId: string, workspaceId: string, threadId: string): Promise<ThreadView> {
        await this.members.require(userId, workspaceId)
        const thread = await this.threads.find(workspaceId, threadId)
        const newestFirst = await this.entityManager.query<Array<ThreadMessageRow>>(LIST_MESSAGES, [
            workspaceId,
            threadId,
            MESSAGE_PAGE,
        ])
        return { thread, messages: newestFirst.map(toMessage).reverse() }
    }

    /** The chain of one thread: its steps in order and the summary line, for a member of the workspace. */
    async chain(userId: string, workspaceId: string, threadId: string): Promise<ChainView> {
        await this.members.require(userId, workspaceId)
        await this.threads.find(workspaceId, threadId)
        return this.chains.view(workspaceId, threadId)
    }
}
