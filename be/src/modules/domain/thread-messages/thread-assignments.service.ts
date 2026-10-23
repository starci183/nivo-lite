import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadMessagesService } from "./thread-messages.service"
import type { AssignmentOpen, OpenedAssignment } from "./thread-messages.contracts"

@Injectable()
/** Giving an agent work from the agent page: a thread opens and the member's first message tags the agent, all or nothing. */
export class ThreadAssignmentsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly directory: MentionDirectoryService,
        private readonly threads: WorkThreadsService,
        private readonly messages: ThreadMessagesService,
    ) {}

    /**
     * Opens a thread authored by the member and writes the text as its first message with the given tags. The text is data and is
     * never read for tags; giving an agent work still needs the agents capability's say-so, and a refusal leaves no thread behind.
     */
    open(input: AssignmentOpen): Promise<OpenedAssignment> {
        return this.entityManager.transaction(async (tx) => {
            await this.directory.ensureMember(tx, input.workspaceId, input.authorMemberId)
            const thread = await this.threads.createFor(
                {
                    workspaceId: input.workspaceId,
                    memberId: input.authorMemberId,
                    title: input.title,
                    leadId: input.leadId,
                    orderId: null,
                },
                tx,
            )
            await this.messages.postAsMember(
                {
                    workspaceId: input.workspaceId,
                    threadId: thread.id,
                    memberId: input.authorMemberId,
                    body: input.text,
                    mentions: input.mentions,
                    quoted: [],
                    locale: input.locale ?? "vi",
                },
                tx,
            )
            return { threadId: thread.id }
        })
    }
}
