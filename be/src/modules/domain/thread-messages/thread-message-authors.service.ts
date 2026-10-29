import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import type { ThreadMessageRead, ThreadMessageRecord } from "./thread-messages.contracts"

/** The name and role an author shows under, by `kind:id`. */
type Authors = ReadonlyMap<string, { readonly name: string; readonly role: string }>

const authorKey = (kind: string, id: string): string => `${kind}:${id}`

/** The message with the name of its author: an agent name and module, or a member display name and role; empty when the author is gone. */
const namedBy = (row: ThreadMessageRead, authors: Authors): ThreadMessageRecord => {
    const author = authors.get(authorKey(row.author_kind, row.author_id))
    return { ...row, author_name: author?.name ?? "", author_role: author?.role ?? "" }
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
        const authorIds = (kind: string): Array<string> =>
            Array.from(new Set(rows.filter((row) => row.author_kind === kind).map((row) => row.author_id)))
        const [agents, members] = await Promise.all([
            this.agents.cardsOf(workspaceId, authorIds("agent")),
            this.members.byIds(workspaceId, authorIds("member"), manager),
        ])
        return new Map([
            ...agents.map((agent) => [authorKey("agent", agent.id), { name: agent.name, role: agent.module }] as const),
            ...members.map(
                (member) => [authorKey("member", member.id), { name: member.displayName, role: member.role }] as const,
            ),
        ])
    }
}
