import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import type { MentionRef } from "@modules/domain/work-chains"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import type {
    MemberNames,
    MentionDirectory,
    MentionOption,
    MentionView,
    OptionalThreadAgent,
    ThreadAgentRef,
} from "./thread-messages.contracts"

const ROLE_GROUPS: ReadonlyArray<string> = ["owner", "manager", "staff"]

/** The most members one directory read answers. */
const MEMBERS_MAX = 200

/** The most agents one directory read answers. */
const AGENTS_MAX = 100

/** The most tags one resolve proves per kind, and the most rooms a directory lists. */
const TAGS_MAX = 20

/** A member of the workspace with the room they sit in. */
interface MemberRef {
    /** The member id (workspace_members.id). */
    readonly id: string
    /** The display name. */
    readonly display_name: string
    /** owner, manager or staff. */
    readonly role: string
    /** The key of the room the member sits in, or null. */
    readonly room_key: string | null
}

/** An agent as the directory lists it. */
interface AgentOption {
    /** The agent id. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The agent module. */
    readonly module: string
}

/** A room that has people in it. */
interface RoomGroup {
    /** The room key. */
    readonly key: string
    /** The room name. */
    readonly name: string
}

const idsOf = (mentions: ReadonlyArray<MentionRef>, kind: MentionRef["kind"]): Array<string> =>
    mentions.filter((mention) => mention.kind === kind).map((mention) => mention.id)

/** The active members of a workspace, each with the first room (by position) they sit in; the caller adds filter, order and bound. */
const activeMembers = (manager: EntityManager, workspaceId: string): SelectQueryBuilder<object> => {
    const members = manager
        .createQueryBuilder()
        .select(["m.id AS id", "m.display_name AS display_name", "m.role AS role"])
        .from("public.workspace_members", "m")
        .where("m.workspace_id = :workspaceId AND m.status = 'active'", { workspaceId })
    const roomKey = members
        .subQuery()
        .select("r.key")
        .from("public.office_rooms_members", "rm")
        .innerJoin("office_rooms", "r", "r.id = rm.room_id")
        .where("rm.user_id = m.user_id AND r.workspace_id = m.workspace_id")
        .orderBy("r.position", "ASC")
        .limit(1)
        .getQuery()
    return members.addSelect(roomKey, "room_key")
}

/** The rooms of a workspace that have at least one person in them; the caller adds filter, order and bound. */
const staffedRooms = (manager: EntityManager, workspaceId: string): SelectQueryBuilder<object> => {
    const rooms = manager
        .createQueryBuilder()
        .select(["r.key AS key", "r.name AS name"])
        .from("public.office_rooms", "r")
        .where("r.workspace_id = :workspaceId", { workspaceId })
    const staffed = rooms
        .subQuery()
        .select("1")
        .from("public.office_rooms_members", "rm")
        .where("rm.room_id = r.id AND rm.user_id IS NOT NULL")
    return rooms.andWhereExists(staffed)
}

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
        const people = await activeMembers(this.entityManager, workspaceId)
            .orderBy("CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END", "ASC")
            .addOrderBy("m.display_name", "ASC")
            .limit(MEMBERS_MAX)
            .getRawMany<MemberRef>()
        const agents = await this.entityManager
            .createQueryBuilder()
            .select(["a.id AS id", "a.name AS name", "a.module AS module"])
            .from("public.agents", "a")
            .where("a.workspace_id = :workspaceId AND a.status = 'active'", { workspaceId })
            .orderBy("a.name", "ASC")
            .limit(AGENTS_MAX)
            .getRawMany<AgentOption>()
        const rooms = await staffedRooms(this.entityManager, workspaceId)
            .orderBy("r.position", "ASC")
            .limit(TAGS_MAX)
            .getRawMany<RoomGroup>()
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
        const people = await this.memberRefs(manager, workspaceId, idsOf(mentions, "member"))
        const agents = await manager
            .createQueryBuilder()
            .select(["a.id AS id", "a.name AS name"])
            .from("public.agents", "a")
            .where("a.workspace_id = :workspaceId AND a.status = 'active' AND a.id = ANY(:agentIds)", {
                workspaceId,
                agentIds: idsOf(mentions, "agent"),
            })
            .limit(TAGS_MAX)
            .getRawMany<ThreadAgentRef>()
        const keys = idsOf(mentions, "group")
            .filter((id) => id.startsWith("room:"))
            .map((id) => id.slice("room:".length))
        const rooms = await staffedRooms(manager, workspaceId)
            .andWhere("r.key = ANY(:keys)", { keys })
            .limit(TAGS_MAX)
            .getRawMany<RoomGroup>()
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
        const row = await manager
            .createQueryBuilder()
            .select("m.id", "id")
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId AND m.user_id = :userId", { workspaceId, userId })
            .limit(1)
            .getRawOne<{ id: string }>()
        if (row === undefined) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MemberNotFound })
        return row.id
    }

    /** Proves a member id names an active member of the workspace. */
    async ensureMember(manager: EntityManager, workspaceId: string, memberId: string): Promise<void> {
        const rows = await this.memberRefs(manager, workspaceId, [memberId])
        if (rows.length === 0) throw new ThreadMessagesError({ code: ThreadMessagesErrorCode.MemberNotFound })
    }

    /** The display name of a member of the workspace; empty when they are not one. */
    async nameOfMember(manager: EntityManager, workspaceId: string, memberId: string): Promise<string> {
        const row = await manager
            .createQueryBuilder()
            .select("m.display_name", "display_name")
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId AND m.id = :memberId", { workspaceId, memberId })
            .limit(1)
            .getRawOne<{ display_name: string }>()
        return row?.display_name ?? ""
    }

    /** The names of the members among the given ids, by id; members that are not active are missing from it. */
    async namesOf(manager: EntityManager, workspaceId: string, memberIds: ReadonlyArray<string>): Promise<MemberNames> {
        const rows = await this.memberRefs(manager, workspaceId, memberIds)
        return Object.fromEntries(rows.map((row) => [row.id, row.display_name]))
    }

    /** The agent of the workspace, or null when there is none with that id. */
    async findAgent(manager: EntityManager, workspaceId: string, agentId: string): Promise<OptionalThreadAgent> {
        const row = await manager
            .createQueryBuilder()
            .select(["a.id AS id", "a.name AS name"])
            .from("public.agents", "a")
            .where("a.workspace_id = :workspaceId AND a.id = :agentId", { workspaceId, agentId })
            .limit(1)
            .getRawOne<ThreadAgentRef>()
        return row ?? null
    }

    private memberRefs(
        manager: EntityManager,
        workspaceId: string,
        memberIds: ReadonlyArray<string>,
    ): Promise<Array<MemberRef>> {
        return activeMembers(manager, workspaceId)
            .andWhere("m.id = ANY(:memberIds)", { memberIds: [...memberIds] })
            .limit(TAGS_MAX)
            .getRawMany<MemberRef>()
    }
}
