import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { MentionRef } from "@modules/domain/work-chains"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import type {
    AgentOptionRow,
    MemberIdRow,
    MemberNameRow,
    MemberRefRow,
    RoomGroupRow,
} from "./persistence/thread-messages.rows"
import {
    FIND_AGENT_REFS,
    FIND_MEMBER_ID,
    FIND_MEMBER_NAME,
    FIND_MEMBER_REFS,
    FIND_ROOM_GROUPS,
    LIST_DIRECTORY_AGENTS,
    LIST_DIRECTORY_MEMBERS,
    LIST_DIRECTORY_ROOMS,
} from "./persistence/thread-messages.sql"
import type { MemberNames, MentionDirectory, MentionOption, MentionView } from "./thread-messages.contracts"

const ROLE_GROUPS: ReadonlyArray<string> = ["owner", "manager", "staff"]

const idsOf = (mentions: ReadonlyArray<MentionRef>, kind: MentionRef["kind"]): Array<string> =>
    mentions.filter((mention) => mention.kind === kind).map((mention) => mention.id)

@Injectable()
/** Who a composer can tag, and the proof that a tag names someone of the workspace. */
export class MentionDirectoryService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The three sections of the `@` list for a member of the workspace: people, active agents, and groups (roles and rooms). */
    async directory(userId: string, workspaceId: string, locale: Locale): Promise<MentionDirectory> {
        await this.members.require(userId, workspaceId)
        const people = await this.entityManager.query<Array<MemberRefRow>>(LIST_DIRECTORY_MEMBERS, [workspaceId])
        const agents = await this.entityManager.query<Array<AgentOptionRow>>(LIST_DIRECTORY_AGENTS, [workspaceId])
        const rooms = await this.entityManager.query<Array<RoomGroupRow>>(LIST_DIRECTORY_ROOMS, [workspaceId])
        const roles: ReadonlyArray<MentionOption> = ROLE_GROUPS.map((role) => ({
            kind: "group",
            id: `role:${role}`,
            name: this.catalog.get(`thread.group.role.${role}`, {}, locale),
            role: "role",
        }))
        return {
            members: people.map((row) => ({ kind: "member", id: row.id, name: row.display_name, role: row.role })),
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
        const people = await manager.query<Array<MemberRefRow>>(FIND_MEMBER_REFS, [
            workspaceId,
            idsOf(mentions, "member"),
        ])
        const agents = await manager.query<Array<{ id: string; name: string }>>(FIND_AGENT_REFS, [
            workspaceId,
            idsOf(mentions, "agent"),
        ])
        const keys = idsOf(mentions, "group")
            .filter((id) => id.startsWith("room:"))
            .map((id) => id.slice("room:".length))
        const rooms = await manager.query<Array<RoomGroupRow>>(FIND_ROOM_GROUPS, [workspaceId, keys])
        const names = new Map<string, string>([
            ...people.map((row): [string, string] => [`member:${row.id}`, row.display_name]),
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
        const [row] = await manager.query<Array<MemberIdRow>>(FIND_MEMBER_ID, [workspaceId, userId])
        if (row === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MemberNotFound })
        return row.id
    }

    /** Proves a member id names an active member of the workspace. */
    async ensureMember(manager: EntityManager, workspaceId: string, memberId: string): Promise<void> {
        const rows = await manager.query<Array<MemberRefRow>>(FIND_MEMBER_REFS, [workspaceId, [memberId]])
        if (rows.length === 0) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MemberNotFound })
    }

    /** The display name of a member of the workspace; empty when they are not one. */
    async nameOfMember(manager: EntityManager, workspaceId: string, memberId: string): Promise<string> {
        const [row] = await manager.query<Array<MemberNameRow>>(FIND_MEMBER_NAME, [workspaceId, memberId])
        return row?.display_name ?? ""
    }

    /** The names of the members among the given ids, by id; members that are not active are missing from it. */
    async namesOf(manager: EntityManager, workspaceId: string, memberIds: ReadonlyArray<string>): Promise<MemberNames> {
        const rows = await manager.query<Array<MemberRefRow>>(FIND_MEMBER_REFS, [workspaceId, memberIds])
        return Object.fromEntries(rows.map((row) => [row.id, row.display_name]))
    }
}
