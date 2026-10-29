import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import type { MentionRef } from "@modules/domain/work-chains"
import { WorkspaceMemberDirectoryService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import type {
    MemberNames,
    MentionDirectory,
    MentionOption,
    MentionView,
    OptionalThreadAgent,
} from "./thread-messages.contracts"

const ROLE_GROUPS: ReadonlyArray<string> = ["owner", "manager", "staff"]

/** The most members one directory read answers. */
const MEMBERS_MAX = 200

/** The most agents one directory read answers. */
const AGENTS_MAX = 100

/** The most tags one resolve proves per kind, and the most rooms a directory lists. */
const TAGS_MAX = 20

const idsOf = (mentions: ReadonlyArray<MentionRef>, kind: MentionRef["kind"]): Array<string> =>
    mentions.filter((mention) => mention.kind === kind).map((mention) => mention.id)

@Injectable()
/** Who a composer can tag, and the proof that a tag names someone of the workspace. */
export class MentionDirectoryService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly memberDirectory: WorkspaceMemberDirectoryService,
        private readonly agents: AgentDirectoryService,
        private readonly rooms: OfficeRoomDirectoryService,
    ) {}

    /** The three sections of the `@` list for a member of the workspace: people, active agents, and groups (roles and rooms). */
    async directory(userId: string, workspaceId: string, locale: Locale): Promise<MentionDirectory> {
        await this.members.require(userId, workspaceId)
        const people = await this.memberDirectory.activeDirectory(workspaceId, MEMBERS_MAX)
        const agents = await this.agents.activeOf(workspaceId, AGENTS_MAX)
        const rooms = await this.rooms.staffedRooms(workspaceId, null, TAGS_MAX)
        const roles: ReadonlyArray<MentionOption> = ROLE_GROUPS.map((role) => ({
            kind: "group",
            id: `role:${role}`,
            name: this.catalog.get(`thread.group.role.${role}`, {}, locale),
            role: "role",
        }))
        return {
            members: people.map((row) => ({ kind: "member", id: row.id, name: row.displayName, role: row.role })),
            agents: agents.map((row) => ({ kind: "agent", id: row.id, name: row.name, role: row.module })),
            groups: [
                ...roles,
                ...rooms.map((row): MentionOption => ({
                    kind: "group",
                    id: `room:${row.key}`,
                    name: this.catalog.get("thread.group.room", { name: row.name }, locale),
                    role: "room",
                })),
            ],
        }
    }

    /** Proves every tag names an active member, an active agent or a staffed room of the workspace and gives each its chip name. */
    async resolve(
        manager: EntityManager,
        workspaceId: string,
        mentions: ReadonlyArray<MentionRef>,
        locale: Locale,
    ): Promise<ReadonlyArray<MentionView>> {
        const people = await this.memberDirectory.activeAmong(workspaceId, idsOf(mentions, "member"), TAGS_MAX, manager)
        const agents = await this.agents.activeInOrder(workspaceId, idsOf(mentions, "agent"), TAGS_MAX)
        const keys = idsOf(mentions, "group")
            .filter((id) => id.startsWith("room:"))
            .map((id) => id.slice("room:".length))
        const rooms = await this.rooms.staffedRooms(workspaceId, keys, TAGS_MAX)
        const names = new Map<string, string>([
            ...people.map((row): [string, string] => [`member:${row.id}`, row.displayName]),
            ...agents.map((row): [string, string] => [`agent:${row.id}`, row.name]),
            ...ROLE_GROUPS.map((role): [string, string] => [
                `group:role:${role}`,
                this.catalog.get(`thread.group.role.${role}`, {}, locale),
            ]),
            ...rooms.map((row): [string, string] => [
                `group:room:${row.key}`,
                this.catalog.get("thread.group.room", { name: row.name }, locale),
            ]),
        ])
        return mentions.map((mention) => {
            const name = names.get(`${mention.kind}:${mention.id}`)
            if (name === undefined) {
                throw new ThreadMessagesError({
                    code: ThreadMessagesErrorCode.MentionUnknown,
                    params: { kind: mention.kind },
                })
            }
            return { ...mention, name }
        })
    }

    /** The member id of a signed-in account in the workspace; the account must be a member, which the caller proved. */
    async memberIdOf(manager: EntityManager, workspaceId: string, userId: string): Promise<string> {
        const id = await this.memberDirectory.idOfUser(workspaceId, userId, manager)
        if (id === null) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MemberNotFound })
        return id
    }

    /** Proves a member id names an active member of the workspace. */
    async ensureMember(manager: EntityManager, workspaceId: string, memberId: string): Promise<void> {
        const rows = await this.memberDirectory.activeAmong(workspaceId, [memberId], TAGS_MAX, manager)
        if (rows.length === 0) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MemberNotFound })
    }

    /** The display name of a member of the workspace; empty when they are not one. */
    async nameOfMember(manager: EntityManager, workspaceId: string, memberId: string): Promise<string> {
        return (await this.memberDirectory.find(workspaceId, memberId, manager))?.displayName ?? ""
    }

    /** The names of the members among the given ids, by id; members that are not active are missing from it. */
    async namesOf(manager: EntityManager, workspaceId: string, memberIds: ReadonlyArray<string>): Promise<MemberNames> {
        const rows = await this.memberDirectory.activeAmong(workspaceId, memberIds, TAGS_MAX, manager)
        return Object.fromEntries(rows.map((row) => [row.id, row.displayName]))
    }

    /** The agent of the workspace, or null when there is none with that id. */
    async findAgent(workspaceId: string, agentId: string): Promise<OptionalThreadAgent> {
        const agent = await this.agents.find(workspaceId, agentId)
        return agent === null ? null : { id: agent.id, name: agent.name }
    }
}
