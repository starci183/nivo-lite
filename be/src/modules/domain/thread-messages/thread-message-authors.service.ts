import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import type { DirectoryMember } from "@modules/domain/workspace-members"
import type { ThreadMessageRead, ThreadMessageRecord } from "./thread-messages.contracts"

/** The agents and members that wrote some messages, by id. */
interface Authors {
    readonly agents: ReadonlyMap<string, AgentCard>
    readonly members: ReadonlyMap<string, DirectoryMember>
}

/** The message with the name of its author: an agent name and module, or a member display name and role; empty when the author is gone. */
const namedBy = (row: ThreadMessageRead, authors: Authors): ThreadMessageRecord => {
    const agent = row.author_kind === "agent" ? authors.agents.get(row.author_id) : undefined
    const member = row.author_kind === "member" ? authors.members.get(row.author_id) : undefined
    return {
        ...row,
        author_name: agent?.name ?? member?.displayName ?? "",
        author_role: agent?.module ?? member?.role ?? "",
    }
}

@Injectable()
/** Puts the name of whoever wrote on the messages of a thread, asking the owners of agents and of members. */
export class ThreadMessageAuthorsService {
    constructor(
        private readonly agents: AgentDirectoryService,
        private readonly members: WorkspaceMemberDirectoryService,
    ) {}

    /** The messages with the names of their authors; an author who is gone is named empty. */
    async withAuthors(
        manager: EntityManager,
        workspaceId: string,
        rows: ReadonlyArray<ThreadMessageRead>,
    ): Promise<Array<ThreadMessageRecord>> {
        const authors = await this.authorsOf(manager, workspaceId, rows)
        return rows.map((row) => namedBy(row, authors))
    }

    /** One message with the name of its author. */
    async withAuthor(
        manager: EntityManager,
        workspaceId: string,
        row: ThreadMessageRead,
    ): Promise<ThreadMessageRecord> {
        return namedBy(row, await this.authorsOf(manager, workspaceId, [row]))
    }

    private async authorsOf(
        manager: EntityManager,
        workspaceId: string,
        rows: ReadonlyArray<ThreadMessageRead>,
    ): Promise<Authors> {
        const idsOf = (kind: string): Array<string> => [
            ...new Set(rows.filter((row) => row.author_kind === kind).map((row) => row.author_id)),
        ]
        const [agents, members] = await Promise.all([
            this.agents.cardsOf(workspaceId, idsOf("agent")),
            this.members.byIds(workspaceId, idsOf("member"), manager),
        ])
        return {
            agents: new Map(agents.map((agent) => [agent.id, agent])),
            members: new Map(members.map((member) => [member.id, member])),
        }
    }
}
