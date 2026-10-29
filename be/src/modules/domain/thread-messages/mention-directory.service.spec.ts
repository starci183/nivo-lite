import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"

const MEMBER: WorkspaceMember = {
    userId: "van",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "Van",
    status: "active",
}

const MINH = "11111111-1111-4111-8111-111111111111"
const SALES_AI = "22222222-2222-4222-8222-222222222222"

interface Answers {
    readonly people?: ReadonlyArray<unknown>
    readonly agents?: ReadonlyArray<unknown>
    readonly rooms?: ReadonlyArray<unknown>
}

/**
 * A manager double for a resolve or a directory read: the first query builder answers the members, the second the agents and the
 * third the rooms, each overridable per spec.
 */
const managerOf = (answers: Answers = {}) => {
    const em = mockEntityManager()
    const people = fakeQueryBuilder({
        getRawMany: answers.people ?? [{ id: MINH, display_name: "Mr Minh", role: "manager", room_key: "sales" }],
    })
    const agents = fakeQueryBuilder({
        getRawMany: answers.agents ?? [{ id: SALES_AI, name: "AI Sales", module: "sales" }],
    })
    const rooms = fakeQueryBuilder({ getRawMany: answers.rooms ?? [{ key: "sales", name: "Sales" }] })
    em.createQueryBuilder
        .mockReturnValueOnce(people.builder as never)
        .mockReturnValueOnce(agents.builder as never)
        .mockReturnValueOnce(rooms.builder as never)
    return { em, people, agents, rooms }
}

/** A manager double whose only query builder answers a single raw row, or nothing. */
const singleRowOf = (row: unknown) => {
    const em = mockEntityManager()
    const read = fakeQueryBuilder({ getRawOne: row })
    em.createQueryBuilder.mockReturnValueOnce(read.builder as never)
    return { em, read }
}

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(MEMBER) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) =>
            typeof params.name === "string" ? `${key}:${params.name}` : key,
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            MentionDirectoryService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(MentionDirectoryService), members }
}

const registerDirectory = () => {
    describe("directory", () => {
        it("lists people, active agents and groups for a member of the workspace", async () => {
            const { em, people, agents, rooms } = managerOf()
            const { service, members } = await build(em)

            const directory = await service.directory("van", "ws-1", "vi")

            expect(members.require).toHaveBeenCalledWith("van", "ws-1")
            expect(people.callsOf("from")).toContainEqual(["public.workspace_members", "m"])
            expect(people.callsOf("limit")).toContainEqual([200])
            expect(agents.callsOf("from")).toEqual([["public.agents", "a"]])
            expect(agents.callsOf("limit")).toEqual([[100]])
            expect(rooms.callsOf("from")).toContainEqual(["public.office_rooms", "r"])
            expect(rooms.callsOf("limit")).toContainEqual([20])
            expect(directory.members).toEqual([{ kind: "member", id: MINH, name: "Mr Minh", role: "manager" }])
            expect(directory.agents).toEqual([{ kind: "agent", id: SALES_AI, name: "AI Sales", role: "sales" }])
            expect(directory.groups).toEqual([
                { kind: "group", id: "role:owner", name: "thread.group.role.owner", role: "role" },
                { kind: "group", id: "role:manager", name: "thread.group.role.manager", role: "role" },
                { kind: "group", id: "role:staff", name: "thread.group.role.staff", role: "role" },
                { kind: "group", id: "room:sales", name: "thread.group.room:Sales", role: "room" },
            ])
        })
    })
}

const registerResolve = () => {
    describe("resolve", () => {
        it("names a member, an agent, a role group and a room group", async () => {
            const { em, people, agents, rooms } = managerOf()
            const { service } = await build(em)

            const views = await service.resolve(
                em,
                "ws-1",
                [
                    { kind: "member", id: MINH },
                    { kind: "agent", id: SALES_AI },
                    { kind: "group", id: "role:manager" },
                    { kind: "group", id: "room:sales" },
                ],
                "vi",
            )

            expect(views).toEqual([
                { kind: "member", id: MINH, name: "Mr Minh" },
                { kind: "agent", id: SALES_AI, name: "AI Sales" },
                { kind: "group", id: "role:manager", name: "thread.group.role.manager" },
                { kind: "group", id: "room:sales", name: "thread.group.room:Sales" },
            ])
            expect(people.callsOf("andWhere")).toEqual([["m.id = ANY(:memberIds)", { memberIds: [MINH] }]])
            expect(agents.callsOf("where")).toEqual([
                [
                    "a.workspace_id = :workspaceId AND a.status = 'active' AND a.id = ANY(:agentIds)",
                    { workspaceId: "ws-1", agentIds: [SALES_AI] },
                ],
            ])
            expect(rooms.callsOf("andWhere")).toContainEqual(["r.key = ANY(:keys)", { keys: ["sales"] }])
        })

        it("refuses a member who is not an active member of the workspace", async () => {
            const { em } = managerOf({ people: [] })
            const { service } = await build(em)

            await expect(service.resolve(em, "ws-1", [{ kind: "member", id: MINH }], "vi")).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MentionUnknown,
                params: { kind: "member" },
            })
        })

        it("refuses an agent that is not an active agent of the workspace", async () => {
            const { em } = managerOf({ agents: [] })
            const { service } = await build(em)

            await expect(service.resolve(em, "ws-1", [{ kind: "agent", id: SALES_AI }], "vi")).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MentionUnknown,
            })
        })

        it("refuses a room nobody sits in", async () => {
            const { em } = managerOf({ rooms: [] })
            const { service } = await build(em)

            await expect(service.resolve(em, "ws-1", [{ kind: "group", id: "room:care" }], "vi")).rejects.toMatchObject(
                {
                    code: ThreadMessagesErrorCode.MentionUnknown,
                    params: { kind: "group" },
                },
            )
        })
    })
}

const registerIdentity = () => {
    describe("identity", () => {
        it("finds the member id of a signed-in account", async () => {
            const { em, read } = singleRowOf({ id: MINH })
            const { service } = await build(em)

            await expect(service.memberIdOf(em, "ws-1", "auth-user")).resolves.toBe(MINH)
            expect(read.callsOf("from")).toEqual([["public.workspace_members", "m"]])
            expect(read.callsOf("where")).toEqual([
                ["m.workspace_id = :workspaceId AND m.user_id = :userId", { workspaceId: "ws-1", userId: "auth-user" }],
            ])
        })

        it("refuses an account that is not a member of the workspace", async () => {
            const { em } = singleRowOf(undefined)
            const { service } = await build(em)

            await expect(service.memberIdOf(em, "ws-1", "stranger")).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MemberNotFound,
            })
        })

        it("accepts an active member id and refuses any other", async () => {
            const active = managerOf().em
            const absent = managerOf({ people: [] }).em
            const { service } = await build(active)

            await expect(service.ensureMember(active, "ws-1", MINH)).resolves.toBeUndefined()
            await expect(service.ensureMember(absent, "ws-1", MINH)).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MemberNotFound,
            })
        })
    })
}

const registerNames = () => {
    describe("names", () => {
        it("names a member of the workspace and answers empty for one that is not", async () => {
            const { em } = singleRowOf({ display_name: "Mr Minh" })
            const { service } = await build(em)
            const gone = singleRowOf(undefined).em

            await expect(service.nameOfMember(em, "ws-1", MINH)).resolves.toBe("Mr Minh")
            await expect(service.nameOfMember(gone, "ws-1", "nobody")).resolves.toBe("")
        })

        it("maps the active members among some ids to their names", async () => {
            const { em, people } = managerOf()
            const { service } = await build(em)

            await expect(service.namesOf(em, "ws-1", [MINH, "left"])).resolves.toEqual({ [MINH]: "Mr Minh" })
            expect(people.callsOf("andWhere")).toEqual([["m.id = ANY(:memberIds)", { memberIds: [MINH, "left"] }]])
        })
    })
}

const registerAgent = () => {
    describe("findAgent", () => {
        it("finds an agent of the workspace by id, or answers null", async () => {
            const found = singleRowOf({ id: SALES_AI, name: "AI Sales" })
            const missing = singleRowOf(undefined)
            const { service } = await build(found.em)

            await expect(service.findAgent(found.em, "ws-1", SALES_AI)).resolves.toEqual({
                id: SALES_AI,
                name: "AI Sales",
            })
            await expect(service.findAgent(missing.em, "ws-1", "nobody")).resolves.toBeNull()
            expect(found.read.callsOf("where")).toEqual([
                ["a.workspace_id = :workspaceId AND a.id = :agentId", { workspaceId: "ws-1", agentId: SALES_AI }],
            ])
        })
    })
}

describe("MentionDirectoryService", () => {
    registerDirectory()
    registerResolve()
    registerIdentity()
    registerNames()
    registerAgent()
})
